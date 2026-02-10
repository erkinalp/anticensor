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

declare global {
    interface Array<T> {
        /**
         * @deprecated never use, idk why but I can't get rid of this without errors
         */
        remove(h: T): never;
        /**
         * Returns a new array with duplicate elements removed.
         */
        distinct(this: T[]): T[];
        /**
         * Returns the only element matching the predicate, or undefined.
         * Throws if more than one element matches.
         */
        single(this: T[], predicate: (elem: T) => boolean): T | undefined;
    }
}
/* https://stackoverflow.com/a/50636286 */
export function arrayPartition<T>(array: T[], filter: (elem: T) => boolean): [T[], T[]] {
    const pass: T[] = [],
        fail: T[] = [];
    array.forEach((e) => (filter(e) ? pass : fail).push(e));
    return [pass, fail];
}

export function arrayRemove<T>(array: T[], item: T): void {
    const index = array.indexOf(item);
    if (index > -1) {
        array.splice(index, 1);
    }
}

// register extensions
// We intentionally define as non-enumerable to avoid breaking for..in loops
const _arrayProtoObj = Array.prototype as unknown as Record<string, unknown>;
if (!("distinct" in _arrayProtoObj)) {
    Object.defineProperty(Array.prototype, "distinct", {
        value: function <T>(this: T[]): T[] {
            return [...new Set(this as unknown as T[])];
        },
        enumerable: false,
    });
}

if (!("single" in _arrayProtoObj)) {
    Object.defineProperty(Array.prototype, "single", {
        value: function <T>(this: T[], predicate: (elem: T) => boolean): T | undefined {
            const matches = (this as unknown as T[]).filter(predicate);
            if (matches.length > 1) throw new Error("Array.single: more than one element matches predicate");
            return matches[0];
        },
        enumerable: false,
    });
}
