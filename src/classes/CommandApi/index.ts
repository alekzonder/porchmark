import * as path from "path";

import {createFileLogger, Logger} from "@/lib/logger";
import {
    IRawCompareReleasesConfig,
    ISite,
    // WatchingMetricsRealNames
} from "@/types";
import {IBrowserLaunchOptions, IPageProfile, IPageStructureSizesHooks, NETWORK_PRESET_TYPES} from "@/classes/Puppeteer";

import {Api} from "@/classes/Api";
import compareReleasesConfigSchema from '@/validation/compareReleasesConfig';
import {ICompareMetricsHooks, IRecordWprConfig, IRecordWprHooks, IWprPair} from "@/classes/Api/types";
import View from "@/classes/View";

export class CommandApi {
    protected _logger: Logger;
    protected _config = {
        findFreePort: {
            beginPort: 10000,
            endPort: 12000,
            host: "127.0.0.1",
            count: 2,
        }
    };
    protected _api: Api;

    constructor(logger: Logger) {
        this._logger = logger;
        this._api = new Api(this._logger);
    }

    public createWorkDir(workDir: string) {
        return this._api.createWorkDir(workDir);
    }

    public async recordWpr(
        workDir: string,
        options: {
            site: ISite,
            browserLaunchOptions: IBrowserLaunchOptions,
            pageProfile: IPageProfile,
        },
    ) {
        return this._api.recordWpr(workDir, {
            ...options,
            id: 0,
        });
    }

    public async recordWprs(
        workDir: string,
        options: {
            headless: boolean,
            sites: ISite[],
        },
    ) {
        const api = this._api;

        await api.createWorkDir(workDir);

        const browserLaunchOptions = {
            ...api.getBaseBrowserLaunchOptions(),
            headless: options.headless,
        };

        const pageProfile = {
            ...api.getBasePageProfile(),
        };
        return this._api.recordOneWprsForManySites(workDir, {
            ...options,
            browserLaunchOptions,
            pageProfile
        });
    }

    public async compareMetrics(
        workDir: string,
        options: {
            headless: boolean,
            sites: ISite[];
            // browserLaunchOptions: IBrowserLaunchOptions;
            // pageProfile: IPageProfile;
            iterations: number;
            useWpr: boolean;
            silent: boolean;
            networkThrottling: null | NETWORK_PRESET_TYPES,
            cpuThrottling: null | {
                rate: number;
            };
            cacheEnabled: null | boolean;
        },
    ) {
        const api = this._api;
        await api.createWorkDir(workDir);

        const browserLaunchOptions = {
            ...api.getBaseBrowserLaunchOptions(),
            headless: options.headless,
        };

        const pageProfile: IPageProfile = {
            ...api.getBasePageProfile(),
            networkThrottling: options.networkThrottling,
            cpuThrottling: options.cpuThrottling,
            cacheEnabled: options.cacheEnabled,
        };

        const {sites, iterations, useWpr, silent} = options;

        const view = new View(this._logger, {});

        return this._api.compareMetrics(workDir, {
            id: 0,
            view,
            sites: sites.map(site => ({...site, wprArchiveId: 0})),
            browserLaunchOptions,
            pageProfile,
            iterations,
            warmIterations: 1,
            useWpr,
            silent,
            singleProcess: false,
            hooks: {},
        });
    }

    public async compareReleases(
        workDir: string,
        rawConfigNotValidated: IRawCompareReleasesConfig,
    ) {
        const api = this._api;
        const rawConfig = await this._api.validate<IRawCompareReleasesConfig>(
            rawConfigNotValidated,
            compareReleasesConfigSchema
        );
        await api.createWorkDir(workDir);
        const compareReleasesConfig = api.prepareCompareReleasesConfig(rawConfig);
        await api.saveConfig(workDir, "compare-releases", compareReleasesConfig);
        for (const comparation of compareReleasesConfig.comparations) {
            const config = comparation.config;
            await api.createWorkDir(config.workDir);
            const browserLaunchOptions = {
                ...api.getBaseBrowserLaunchOptions(),
                headless: config.headless,
            };
            const pageProfile = {
                ...api.getBasePageProfile(),
                networkThrottling: compareReleasesConfig.options.networkThrottling,
                cpuThrottling: compareReleasesConfig.options.cpuThrottling,
                cacheEnabled: compareReleasesConfig.options.cacheEnabled,
            };
            if (rawConfig.stages.recordWpr) {
                await api.recordOneWprsForManySites(config.workDir, {
                    sites: config.sites,
                    browserLaunchOptions,
                    pageProfile,
                });
            }
            if (rawConfig.stages.compareMetrics) {
                const view = new View(this._logger, {});
                await api.compareMetrics(config.workDir, {
                    id: 0,
                    view,
                    sites: config.sites.map(site => ({...site, wprArchiveId: 0})),
                    browserLaunchOptions,
                    pageProfile,
                    iterations: compareReleasesConfig.options.iterations,
                    warmIterations: 1, // TODO
                    useWpr: config.useWpr,
                    silent: config.silent,
                    singleProcess: typeof rawConfig.options.singleProcess !== 'undefined'
                        ? rawConfig.options.singleProcess
                        : false,
                    hooks: {},
                });
            }
            this._logger.info("compare-releases complete");
        }
    }

    public async compareReleasesCyclic(
        compareWorkDir: string,
        rawConfigNotValidated: IRawCompareReleasesConfig,
    ) {
        await Api.createWorkDir(this._logger, compareWorkDir);
        const logger = createFileLogger(
            path.resolve(compareWorkDir,
                `compare-releases-${(new Date()).toISOString()}.log`)
        );
        const api = new Api(logger);
        const rawConfig = await this._api.validate<IRawCompareReleasesConfig>(
            rawConfigNotValidated,
            compareReleasesConfigSchema
        );
        await api.saveConfig(compareWorkDir, "compare-releases-cyclic-raw-config", rawConfig);
        const compareReleasesConfig = api.prepareCompareReleasesConfig(rawConfig);
        await api.saveConfig(compareWorkDir, "compare-releases-cyclic-prepared-config", compareReleasesConfig);

        const {options} = compareReleasesConfig;

        const recordCount = rawConfig.options.recordCount;
        const cycleCount = rawConfig.options.cycleCount;

        for (const comparation of compareReleasesConfig.comparations) {
            const config = comparation.config;
            await this.createWorkDir(config.workDir);
            const browserLaunchOptions = {
                ...api.getBaseBrowserLaunchOptions(),
                headless: config.headless,
            };
            const recordWprPageProfile: IPageProfile = {
                ...api.getBasePageProfile(),
                networkThrottling: options.networkThrottling,
                cpuThrottling: options.cpuThrottling,
                cacheEnabled: options.cacheEnabled,
            };

            if (rawConfig.stages.recordWpr) {
                const hooks: IRecordWprHooks & IPageStructureSizesHooks = {};

                if (rawConfig.hooks) {
                    if (rawConfig.hooks.onVerifyWpr) {
                        hooks.onVerifyWpr = rawConfig.hooks.onVerifyWpr;
                    }

                    if (rawConfig.hooks.onPageStructureSizesNode) {
                        hooks.onPageStructureSizesNode = rawConfig.hooks.onPageStructureSizesNode;
                    }

                    if (rawConfig.hooks.onPageStructureSizesComplete) {
                        hooks.onPageStructureSizesComplete = rawConfig.hooks.onPageStructureSizesComplete;
                    }
                }

                await api.recordManyWprsForManySites(config.workDir, {
                    recordCount,
                    sites: config.sites,
                    browserLaunchOptions,
                    pageProfile: recordWprPageProfile,
                    hooks,
                });
            }

            // select best of the best wprs
            const wprs = await api.getWprSizes(config.workDir, config.sites);
            logger.info("wprSizes:");
            wprs.forEach(wpr => {
                const sizes = [
                    `size=${wpr.size}`,
                    `page=${wpr.pageStructureSizes.root}`,
                    `script=${wpr.pageStructureSizes.script}`,
                    `style=${wpr.pageStructureSizes.style}`,
                ];
                logger.info(`${wpr.filename} ${sizes.join(', ')}`);
            });

            // bestPairsCloser
            const bestPairsCloser = await api.getBestWprPairsMethodCloser(wprs, config.sites, cycleCount);
            logger.info("bestPairsCloser:");
            bestPairsCloser.forEach((pair, i) => {
                const {
                    aWprArchiveId: aId,
                    aWprArchiveSize: aSize,
                    bWprArchiveId: bId,
                    bWprArchiveSize: bSize,
                    diff
                } = pair;
                logger.info(`${i}: a[${aId}]=${aSize} - b[${bId}]=${bSize} = ${diff}`)
            });

            // bestPairsQuantiles
            const bestPairsQuantiles = await api.getBestWprPairsMethodQuantiles(wprs, config.sites, cycleCount);
            logger.info("bestPairsQuantiles:");
            bestPairsQuantiles.forEach((pair, i) => {
                const {
                    aWprArchiveId: aId,
                    aWprArchiveSize: aSize,
                    bWprArchiveId: bId,
                    bWprArchiveSize: bSize,
                    diff
                } = pair;
                logger.info(`${i}: a[${aId}]=${aSize} - b[${bId}]=${bSize} = ${diff}`)
            });

            // bestPairsCloserHtmlCloser
            const bestPairsCloserHtmlCloser = await api.getBestWprPairsMethodHtmlCloser(wprs, config.sites, cycleCount);
            logger.info("bestPairsCloserHtmlCloser:");
            bestPairsCloserHtmlCloser.forEach((pair, i) => {
                const {
                    aWprArchiveId: aId,
                    aWprArchiveSize: aSize,
                    bWprArchiveId: bId,
                    bWprArchiveSize: bSize,
                    diff
                } = pair;
                logger.info(`${i}: a[${aId}]=${aSize} - b[${bId}]=${bSize} = ${diff}`)
            });

            // bestPairsCloserScriptCloser
            const bestPairsCloserScriptCloser = await api.getBestWprPairsMethodScriptCloser(wprs, config.sites, cycleCount);
            logger.info("bestPairsCloserScriptCloser:");
            bestPairsCloserScriptCloser.forEach((pair, i) => {
                const {
                    aWprArchiveId: aId,
                    aWprArchiveSize: aSize,
                    bWprArchiveId: bId,
                    bWprArchiveSize: bSize,
                    diff
                } = pair;
                logger.info(`${i}: a[${aId}]=${aSize} - b[${bId}]=${bSize} = ${diff}`)
            });

            const selectWprMethod = rawConfig.options.selectWprMethod
                ? rawConfig.options.selectWprMethod
                : "bestPairsQuantiles";
            logger.info(`using ${selectWprMethod}`);

            let bestPairs: IWprPair[] = [];

            switch (selectWprMethod) {
                case 'bestPairsQuantiles':
                    bestPairs = bestPairsQuantiles;
                    break;
                case 'bestPairsCloser':
                    bestPairs = bestPairsCloser;
                    break;
                case 'bestPairsCloserHtmlCloser':
                    bestPairs = bestPairsCloserHtmlCloser;
                    break;
                case 'bestPairsCloserScriptCloser':
                    bestPairs = bestPairsCloserScriptCloser;
                    break;

            }
            if (!bestPairs.length) {
                throw new Error('cannot compare releases, no bestPairs, no WPR files');
            }

            const bestSiteWithWprPairs = await api.prepareSitesWithWprArchiveId(config.sites, bestPairs);
            logger.info("bestSiteWithWprPairs:\n", bestSiteWithWprPairs);

            const openPagePageProfile = {
                ...recordWprPageProfile,
                javascriptEnabled: options.javascriptEnabled,
                cssFilesEnabled: options.cssFilesEnabled,
            };

            if (rawConfig.stages.compareMetrics) {
                let id = 0;

                const view = new View(logger, {});

                const dataProcessorConfig = api.createDefaultDataProcessorConfig();

                if (rawConfig.metrics) {
                    dataProcessorConfig.metrics = rawConfig.metrics;
                }

                if (rawConfig.metricAggregations) {
                    dataProcessorConfig.metricAggregations = rawConfig.metricAggregations;
                }

                const dataProcessor = api.createDataProcessor(dataProcessorConfig);

                const setTableDataInterval = setInterval(async () => {
                    const report = await dataProcessor.calcReport(config.sites);
                    await view.setTableData(report);
                }, 200); // TODO

                await view.init();
                await view.start();

                const hooks: ICompareMetricsHooks = {};

                if (rawConfig.hooks && rawConfig.hooks.onCollectMetrics) {
                    hooks.onCollectMetrics = rawConfig.hooks.onCollectMetrics;
                }

                try {
                    for (const sites of bestSiteWithWprPairs) {
                        await api.compareMetrics(config.workDir, {
                            id,
                            view,
                            dataProcessor,
                            sites,
                            browserLaunchOptions,
                            pageProfile: openPagePageProfile,
                            iterations: compareReleasesConfig.options.iterations,
                            warmIterations: rawConfig.options.warmIterations,
                            useWpr: config.useWpr,
                            silent: config.silent,
                            singleProcess: rawConfig.options.singleProcess,
                            hooks,
                        });
                        id++;
                    }
                } finally {
                    clearInterval(setTableDataInterval);
                    await view.setTableData(await dataProcessor.calcReport(config.sites));
                    await view.screen.render();
                    await view.stop();
                }

                const report = await dataProcessor.calcReport(config.sites);
                await api.saveTotalReport(config.workDir, report);
                await api.saveHumanTotalReport(config.workDir, report);
            }
        }
    }

    public async compareLighthouse(
        compareWorkDir: string,
        rawConfigNotValidated: IRawCompareReleasesConfig,
    ) {
        await Api.createWorkDir(this._logger, compareWorkDir);
        const logger = createFileLogger(
            path.resolve(compareWorkDir, `compare-lighthouse-${(new Date()).toISOString()}.log`)
        );
        const api = new Api(logger);
        const rawConfig = await this._api.validate<IRawCompareReleasesConfig>(
            rawConfigNotValidated,
            compareReleasesConfigSchema
        );
        await api.saveConfig(compareWorkDir, "compare-lighthouse-raw-config", rawConfig);
        const compareReleasesConfig = api.prepareCompareReleasesConfig(rawConfig);
        await api.saveConfig(compareWorkDir, "compare-lighthouse-prepared-config", compareReleasesConfig);

        const recordCount = rawConfig.options.recordCount;
        const cycleCount = rawConfig.options.cycleCount;

        for (const comparation of compareReleasesConfig.comparations) {
            const config = comparation.config;
            await this.createWorkDir(config.workDir);
            const browserLaunchOptions = {
                ...api.getBaseBrowserLaunchOptions(),
                headless: config.headless,
            };
            const pageProfile = {
                ...api.getBasePageProfile(),
                networkThrottling: compareReleasesConfig.options.networkThrottling,
                cpuThrottling: compareReleasesConfig.options.cpuThrottling,
                cacheEnabled: compareReleasesConfig.options.cacheEnabled,
            };

            if (rawConfig.stages.recordWpr) {
                const hooks: IRecordWprHooks = {};

                if (rawConfig.hooks && rawConfig.hooks.onVerifyWpr) {
                    hooks.onVerifyWpr = rawConfig.hooks.onVerifyWpr;
                }

                // записать несколько wpr для каждого site
                await api.recordManyWprsForManySites(config.workDir, {
                    recordCount,
                    sites: config.sites,
                    browserLaunchOptions,
                    pageProfile,
                    hooks,
                });
            }

            const wprs = await api.getWprSizes(config.workDir, config.sites);
            const bestPairsQuantiles = await api.getBestWprPairsMethodQuantiles(wprs, config.sites, cycleCount);

            logger.info("using bestPairsQuantiles");
            const bestPairs = bestPairsQuantiles;
            const bestSiteWithWprPairs = await api.prepareSitesWithWprArchiveId(config.sites, bestPairs);
            logger.info("bestSiteWithWprPairs:", bestSiteWithWprPairs);

            let id = 0;

            const results = {};

            for (const sites of bestSiteWithWprPairs) {
                await api.compareLighthouse(config.workDir, {
                    id,
                    sites,
                    iterations: config.iterations,
                    results,
                    imagesEnabled: compareReleasesConfig.options.imagesEnabled,
                });

                id++;
            }
        }
    }

    public async startBrowserWithWpr(
        workDir: string,
        wprArchiveFilepath: string
    ) {
        await this._api.createWorkDir(workDir);
        return this._api.startBrowserWithWpr(workDir, wprArchiveFilepath);
    }

    public async getPageStructureSizes(
        workDir: string,
        rawConfigNotValidated: IRawCompareReleasesConfig,
        url: string,
    ) {
        const api = new Api(this._logger);
        const rawConfig = await this._api.validate<IRawCompareReleasesConfig>(
            rawConfigNotValidated,
            compareReleasesConfigSchema
        );

        const hooks: IRecordWprHooks & IPageStructureSizesHooks = {};

        if (rawConfig.hooks) {
            if (rawConfig.hooks.onVerifyWpr) {
                hooks.onVerifyWpr = rawConfig.hooks.onVerifyWpr;
            }

            if (rawConfig.hooks.onPageStructureSizesNode) {
                hooks.onPageStructureSizesNode = rawConfig.hooks.onPageStructureSizesNode;
            }

            if (rawConfig.hooks.onPageStructureSizesComplete) {
                hooks.onPageStructureSizesComplete = rawConfig.hooks.onPageStructureSizesComplete;
            }
        }

        const browserLaunchOptions: IBrowserLaunchOptions = {
            headless: true,
            ignoreHTTPSErrors: true,
            wpr: null,
            imagesEnabled: true,
        };

        const pageProfile: IPageProfile = {
            ...api.getBasePageProfile(),
        };

        const config: IRecordWprConfig = {
            id: 0,
            site: {
                name: 'test',
                url,
                mobile: rawConfig.options.mobile,
            },
            browserLaunchOptions,
            pageProfile,
            hooks,
        };

        const {pageSizes} = await api.getPageStructureSizes(workDir, config, {takeScreenshot: false, useWpr: false});

        console.log(JSON.stringify(pageSizes, null, 2));
    }
}
