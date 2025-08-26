export interface MemberVerificationDecisionSchema {
	user_id: string;
	decision: "accept" | "reject";
	reason?: string;
}
