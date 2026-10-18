/** Общий разбор ошибок Nest ValidationPipe / HttpException для BFF. */
export async function readNestError(res: Response): Promise<string | null> {
  try {
    const errBody = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(errBody.message)) return errBody.message.join(', ');
    if (typeof errBody.message === 'string') return errBody.message;
  } catch {
    /* empty */
  }
  return null;
}
