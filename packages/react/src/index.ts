// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * @poh-kit/react
 *
 * React hooks for the enrollment and signaling flows.
 *
 * This is a skeleton — no implementation yet.
 */

export interface UseEnrollmentResult {
  status: "idle" | "awaiting-scan" | "verifying" | "verified" | "error";
  error?: Error;
  startEnrollment: () => Promise<void>;
}

export function useEnrollment(): UseEnrollmentResult {
  throw new Error("not yet implemented — see roadmap in README.md");
}

export interface UseAnonymousVoteResult {
  status: "idle" | "proving" | "submitting" | "submitted" | "error";
  error?: Error;
  castVote: (optionId: string) => Promise<void>;
}

export function useAnonymousVote(_proposalId: string): UseAnonymousVoteResult {
  throw new Error("not yet implemented — see roadmap in README.md");
}