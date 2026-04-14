import { ConnectedAccount } from "@harmony/util";

export type PublicConnectedAccount = Pick<ConnectedAccount, "name" | "type" | "verified">;
