import {Logger} from "@/lib/logger";
import jstat from 'jstat';
import {ISite, SiteName} from "@/types";

export type IMetricAggregation = {
    name: 'q50' | 'q80' | 'q95' | 'stdev' | 'count',
    includeMetrics?: string[];
    excludeMetrics?: string[];
};

export type IMetric = {
    name: string;
    title?: string;
};

export interface IDataProcessorConfig {
    metrics: IMetric[];
    metricAggregations: IMetricAggregation[];
}

export interface IOriginalMetrics {
    [index: string]: number;
}

export interface IMetrics {
    [index: string]: number[];
}

export interface IReport {
    headers: string[];
    data: (string)[][];
    rawData: (number | string)[][];
}

export default class DataProcessor {
    protected _logger: Logger;
    protected _config: IDataProcessorConfig;
    protected _metrics: {
        [index: string]: IMetrics, // [index: SiteName]
    };

    constructor(logger: Logger, config: IDataProcessorConfig) {
        this._logger = logger;
        this._config = config;
        this._metrics = {};
    }

    public async registerMetrics(siteName: SiteName, originalMetrics: IOriginalMetrics) {
        for (const [metricName, metricValue] of Object.entries(originalMetrics)) {
            const metric = this._getSiteMetric(siteName, metricName);
            metric.push(metricValue);
        }
    }

    public async calcReport(sites: ISite[]) {
        const siteNames = sites.map(site => site.name);
        const headers = [
            'metric',
            'func',
            ...siteNames,
            'diff',
            'p-value',
        ];

        const report: IReport = {
            headers,
            data: [],
            rawData: [],
        };

        for (const metric of this._config.metrics) {
            const metricName = metric.name;
            const metricTitle = metric.title ? metric.title : metric.name;

            for (const aggregation of this._config.metricAggregations) {
                const rawRow: (number | string)[] = [metricTitle, aggregation.name];
                const row: string[] = [metricTitle, aggregation.name];

                if (aggregation.includeMetrics && !aggregation.includeMetrics.includes(metricName)) {
                    this._logger.info(`includeMetrics: skip aggregation=${aggregation.name} for metric=${metricName}`);
                    continue;
                }

                if (aggregation.excludeMetrics && aggregation.excludeMetrics.includes(metricName)) {
                    this._logger.info(`excludeMetrics: skip aggregation=${aggregation.name} for metric=${metricName}`);
                    continue;
                }

                const allSitesMetrics = [];

                const values = [];

                for (const siteName of siteNames) {
                    const metricValues = this._getSiteMetric(siteName, metricName);
                    allSitesMetrics.push(metricValues);

                    const aggregated = this._calcAggregation(aggregation, metricName, metricValues);
                    rawRow.push(aggregated);

                    const fixedNumber = this._toFixedNumber(aggregated);
                    row.push(fixedNumber);

                    values.push(aggregated);
                }

                // add diff
                const diff = values[1] - values[0];
                row.push(`${this._getSign(diff)}${this._toFixedNumber(diff)}`);

                // calc p-value
                const pval = jstat.anovaftest(...allSitesMetrics);
                rawRow.push(pval);
                row.push(this._toFixedNumber(pval));

                report.rawData.push(rawRow);
                report.data.push(row);
            }
        }

        return report;
    }

    protected _toFixedNumber(i: number): string {
        return typeof i === 'number' ? i.toFixed(2) : '-';
    }

    protected _getSign(i: number) {
        return i > 0 ? '+' : '';
    }

    protected _getSiteMetric(siteName: string, metricName: string): number[] {
        if (!this._metrics[siteName]) {
            this._metrics[siteName] = {};
        }

        if (!this._metrics[siteName][metricName]) {
            this._metrics[siteName][metricName] = [];
        }

        return this._metrics[siteName][metricName];
    }

    protected _calcAggregation(aggregation: IMetricAggregation, metricName: string, metrics: number[]) {
        this._logger.debug(`metric=${metricName}: calc aggregation=${aggregation}`);

        switch (aggregation.name) {
            case 'q50':
                return jstat.percentile(metrics, 0.5);
            case 'q80':
                return jstat.percentile(metrics, 0.8);
            case 'q95':
                return jstat.percentile(metrics, 0.9);
            case 'stdev':
                return jstat.stdev(metrics, true);
            case 'count':
                return metrics.length;
            default:
                throw new Error(`unknown aggregation ${aggregation}`);
        }
    }
}
