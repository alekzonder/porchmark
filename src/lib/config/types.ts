import puppeteer from 'puppeteer';

import {Logger} from '@/lib/logger';
import {IPageStructureSizes} from '@/lib/puppeteer/types';
import {ISite} from '@/types';

export enum SelectWprMethods {
  WprSizeCloser = 'WprSizeCloser',
  WprSizeQuantiles25to75 = 'WprSizeQuantiles25to75',
  HtmlSizeCloser = 'HtmlSizeCloser',
  HtmlScriptSizeCloser = 'HtmlScriptSizeCloser',
}

export type NetworkProfiles = 'GPRS' | 'Regular2G' | 'Good2G' | 'Regular3G' | 'Good3G' | 'Regular4G' | 'DSL' | 'WiFi';

export interface IPuppeteerOptions {
  headless: boolean;
  warmIterations: number;
  useWpr: boolean;
  recordWprCount: number;
  selectWprCount: number;
  selectWprMethod: SelectWprMethods;
  cacheEnabled: boolean;
  cpuThrottling?: {
    rate: number;
  };
  networkThrottling?: NetworkProfiles;
  // singleProcess: boolean; ?
  imagesEnabled: boolean;
  javascriptEnabled: boolean;
  cssFilesEnabled: boolean;
}

export interface IWebdriverOptions {
  host: string;
  port: number;
  user: string;
  key: string;
  desiredCapabilities: {
    browserName: string;
    version: string;
  };
}

export interface IBrowserProfile {
  mobile: boolean;
  userAgent?: string;
  width?: number;
  height?: number;
}

export interface IComparison {
  name: string;
  sites: ISite[];
}

export interface IConfigMetric {
  name: string;
  title?: string;
}

export interface IConfigMetricsAggregation {
  name: string;
  includeMetrics?: string[];
  excludeMetrics?: string[];
}

export type VerifyWprHook = (logger: Logger, page: puppeteer.Page) => Promise<void>;
export type CollectMetricsHook = (logger: Logger, page: puppeteer.Page) => Promise<{[index: string]: number}>;

// TODO node type
export type PageStructureSizesNodeHook = (sizes: IPageStructureSizes, node: any) => void;

export type PageStructureSizesCompleteHook = (
  sizes: IPageStructureSizes,
  html: string,
  getSizeInBytes: (html: string, start: number, end: number) => number,
) => void;

export interface IConfigHooks {
  onVerifyWpr?: VerifyWprHook;
  onCollectMetrics?: CollectMetricsHook;
  onPageStructureSizesNode?: PageStructureSizesNodeHook;
  onPageStructureSizesComplete?: PageStructureSizesCompleteHook;
}

export interface IConfig {
  workDir: string;
  mode: 'puppeteer' | 'webdriver';
  iterations: number;
  puppeteerOptions?: IPuppeteerOptions;
  webdriverOptions?: IWebdriverOptions;
  browserProfile: IBrowserProfile;
  comparisons: IComparison[];
  stages: {
    recordWpr: boolean;
    compareMetrics: boolean;
    compareLighthouse: boolean;
  };
  metrics: IConfigMetric[];
  metricAggregations: IConfigMetricsAggregation[];
  hooks: IConfigHooks;
}