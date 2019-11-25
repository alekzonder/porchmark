import fs, {Stats} from "fs";

// TODO remove and migrate to fs-extra

export const exists = (filepath: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        fs.access(filepath, (err) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    return resolve(false);
                }

                return reject(err);
            }

            resolve(true);
        });
    });
};

export const stat = (filepath: string): Promise<Stats> => {
    return new Promise((resolve, reject) => {
        fs.stat(filepath, (err, stat) => {
            if (err) {
                return reject(err);
            }
            resolve(stat);
        });
    });
};

export const mkdir = (dirpath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        fs.mkdir(dirpath, (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
};

export const writeFile = (filepath: string, data: String | Buffer): Promise<void> => {
    return new Promise((resolve, reject) => {
        fs.writeFile(filepath, data, (err) => {
            if (err) {
                return reject(err);
            }

            resolve();
        });
    });
};

export const readFile = (filepath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        fs.readFile(filepath, (err, data) => {
            if (err) {
                return reject(err);
            }

            resolve(data.toString());
        });
    });
};

export const writeJson = (filepath: string, data: any) => {
    return writeFile(filepath, JSON.stringify(data, null, 2));
};

export const readJson = async (filepath: string) => {
    const data = await readFile(filepath);

    let json: any = null;

    try {
        json = JSON.parse(data);
    } catch (e) {
        throw new Error(`invalid json in file: ${filepath}`);
    }

    return json;
};

export const createWriteStream = fs.createWriteStream;

export const readdir = (dirpath: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        fs.readdir(dirpath, (err, files) => {
            if (err) {
                return reject(err);
            }

            resolve(files);
        });
    });
};
