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
import Storage from "harmony-storage";

let storage: Storage;
if (process.env.STORAGE_PROVIDER === "file" || !process.env.STORAGE_PROVIDER) {
    storage = FileStorage.init();
} else if (process.env.STORAGE_PROVIDER === "s3") {
    try {
        const s3 = require("harmony-s3").default as typeof Storage;
        storage = s3.init();
    } catch (e) {
        console.error("For S3 storage you need to install the harmony-S3 package\nnpm i --no-save harmony-S3");
        throw e;
    }
}

export { storage };
