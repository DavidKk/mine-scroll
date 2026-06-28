export class LeaderboardServiceError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'LeaderboardServiceError'
    this.statusCode = statusCode
  }
}

export function isLeaderboardServiceError(error: unknown): error is LeaderboardServiceError {
  return error instanceof LeaderboardServiceError
}
