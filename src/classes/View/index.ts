import blessed = require("blessed");
import contrib = require('blessed-contrib');

import {Logger} from "@/lib/logger";
import {IReport} from "@/classes/DataProcessor";


interface IViewConfig {

}

const RENDER_INTERVAL = 200;

export default class View {
    protected _logger: Logger;
    protected _config: IViewConfig;
    protected _screen: blessed.Widgets.Screen | null = null;
    protected _table: contrib.Widgets.TableElement | null = null;
    protected _renderInterval: NodeJS.Timer | null = null;

    constructor(logger: Logger, config: IViewConfig) {
        this._logger = logger;
        this._config = config;
    }

    get screen() {
        if (!this._screen) {
            throw new Error("View: blessed screen not initialized");
        }

        return this._screen;
    }

    get table() {
        if (!this._table) {
            throw new Error("View: blessed-contrib table not initialized");
        }

        return this._table;
    }

    public async init() {
        this._screen = blessed.screen({smartCSR: true});

        this._table = contrib.table({
            keys: true,
            fg: 'white',
            selectedFg: 'black',
            selectedBg: 'green',
            interactive: 'true',
            label: 'porchmark 2.0',
            width: '60%',
            height: '100%',
            border: {type: "line", fg: "cyan"},
            columnSpacing: 10, //in chars
            columnWidth: [15, 10, 12, 12, 12] /*in chars*/
        });

        this.table.focus();

        this.screen.append(this.table);

        // TODO hook onClose or external
        this.screen.key([/* 'escape', 'q', */ 'C-c'], function(/* ch, key */) {
            return process.exit(0);
        });
    }

    public async setTableData(report: IReport) {
        this.table.setData(report);
    }

    public async start() {
        this._renderInterval = setInterval(() => {
            this.screen.render();
        }, RENDER_INTERVAL);
    }

    public async stop() {
        if (this._renderInterval) {
            clearInterval(this._renderInterval);
        }

        this.screen.destroy();
    }
}
