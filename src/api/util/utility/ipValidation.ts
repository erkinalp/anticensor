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

import { UserIpAccess } from "../../../util/entities/UserIpAccess";

export function isValidIpAddress(ip: string): boolean {
	const ipv4Regex =
		/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
	const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
	const cidrRegex =
		/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;

	return ipv4Regex.test(ip) || ipv6Regex.test(ip) || cidrRegex.test(ip);
}

export function isIpInRange(ip: string, allowedIps: string[]): boolean {
	for (const allowedIp of allowedIps) {
		if (allowedIp.includes("/")) {
			if (ip === allowedIp.split("/")[0]) return true;
		} else {
			if (ip === allowedIp) return true;
		}
	}
	return false;
}

export function isLocalhostIp(ip: string): boolean {
	return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

export async function checkUserIpAccess(
	userId: string,
	currentIp: string,
): Promise<boolean> {
	const ipAccess = await UserIpAccess.findOne({ where: { user_id: userId } });
	if (!ipAccess || ipAccess.ips.length === 0) {
		return true;
	}
	return isIpInRange(currentIp, ipAccess.ips);
}
