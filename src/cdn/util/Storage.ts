/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2025 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { FileStorage } from "./FileStorage";
import { S3Storage } from "./S3Storage";
process.cwd();

export abstract class Storage {
    abstract set(path: string, data: Buffer): Promise<void>;
    abstract clone(path: string, newPath: string): Promise<void>;
    abstract get(path: string): Promise<Buffer | null>;
    abstract delete(path: string): Promise<void>;
    abstract exists(path: string): Promise<boolean>;
    abstract isFile(path: string): Promise<boolean>;
    abstract move(path: string, newPath: string): Promise<void>;
}

let storage: Storage;

if (process.env.STORAGE_PROVIDER === "file" || !process.env.STORAGE_PROVIDER) {
    storage = FileStorage.init();
} else if (process.env.STORAGE_PROVIDER === "s3") {
    storage = S3Storage.init();
}

export { storage };
