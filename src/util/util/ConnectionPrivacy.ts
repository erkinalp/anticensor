/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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

import { ConnectedAccount } from "../entities/ConnectedAccount";

export enum VisibilityLevel {
    PRIVATE = 0,
    FRIENDS_ONLY = 1,
    MUTUAL_GUILDS = 2,
    PUBLIC = 3,
}

export class ConnectionPrivacy {
    static filterConnectedAccounts(accounts: ConnectedAccount[], viewerUserId: string, targetUserId: string): ConnectedAccount[] {
        return accounts.filter((account) => this.isConnectionVisible(account, viewerUserId, targetUserId));
    }

    static isConnectionVisible(account: ConnectedAccount, viewerUserId: string, targetUserId: string): boolean {
        const effectiveVisibility = this.getEffectiveVisibility(account);

        if (effectiveVisibility === VisibilityLevel.PRIVATE) {
            return viewerUserId === targetUserId;
        }

        if (effectiveVisibility === VisibilityLevel.PUBLIC) {
            return true;
        }

        return viewerUserId === targetUserId || effectiveVisibility >= VisibilityLevel.MUTUAL_GUILDS;
    }

    static shouldShareActivity(account: ConnectedAccount): boolean {
        return account.show_activity !== 0;
    }

    static shouldShareMetadata(account: ConnectedAccount): boolean {
        return account.metadata_visibility !== 0;
    }

    static getEffectiveVisibility(account: ConnectedAccount): number {
        return account.visibility ?? 0;
    }
}
