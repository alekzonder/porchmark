import joi = require('@hapi/joi');

import {NETWORK_PRESETS} from "@/classes/Puppeteer";

const schema = joi.object().required().keys({
    workDir: joi.string().required(),
    options: joi.object().required().keys({
        headless: joi.boolean().default(true),
        warmIterations: joi.number().integer().min(0).default(1),
        iterations: joi.number().integer().min(1).default(11),
        mobile: joi.boolean().default(false),
        useWpr: joi.boolean().default(true),
        silent: joi.boolean().default(false),
        recordCount: joi.number().integer().min(1).default(10),
        cycleCount: joi.number().integer().min(1).default(1),
        cacheEnabled: joi.boolean().default(true),
        cpuThrottling: joi.object().keys({
            rate: joi.number().integer().min(0),
        }),
        networkThrottling: joi.string().valid(...Object.keys(NETWORK_PRESETS)),
        selectWprMethod: joi.string()
            .valid(...['bestPairsQuantiles', 'bestPairsCloser', 'bestPairsCloserHtmlCloser', 'bestPairsCloserScriptCloser'])
            .default('bestPairsQuantiles'),
        singleProcess: joi.boolean().default(false),
        imagesEnabled: joi.boolean().default(true),
        javascriptEnabled: joi.boolean().default(true),
        cssFilesEnabled: joi.boolean().default(true),
    }),
    hosts: joi.array().required().items(joi.object().required().keys({
        name: joi.string().required(),
        host: joi.string().required().uri({scheme: ['http', 'https']})
    })),
    urls: joi.array().required().items(joi.object().required().keys({
        name: joi.string().required(),
        url: joi.string().required(),
    })),
    stages: joi.object().required().keys({
        recordWpr: joi.boolean().default(true),
        compareMetrics: joi.boolean().default(true)
    }),
    metrics: joi.array().min(1).items(
        joi.object().keys({
            name: joi.string().required(),
            title: joi.string(),
        })
    ),
    metricAggregations: joi.array().min(1).items(
        joi.object().keys({
            name: joi.string().required().valid(['q50', 'q80', 'q95', 'count', 'stdev']),
            includeMetrics: joi.array().items(joi.string()),
            excludeMetrics: joi.array().items(joi.string())
        })
    ),
    hooks: joi.object().keys({
        onVerifyWpr: joi.func(),
        onCollectMetrics: joi.func(),
        onPageStructureSizesNode: joi.func(),
        onPageStructureSizesComplete: joi.func(),
    }),
});

export default schema;
