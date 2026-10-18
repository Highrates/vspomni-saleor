import { NextResponse } from 'next/server';
import { getAdminSession } from './getAdminSession';
import type { AdminSectionId } from './adminSections';

type RequireOk = {
  ok: true;
};

type RequireFail = {
  ok: false;
  response: NextResponse;
};

/** ACL для server routes (revalidate и т.п.): cookie + grant секции или суперадмин. */
export async function requireAdminSection(
  section: AdminSectionId,
): Promise<RequireOk | RequireFail> {
  const session = await getAdminSession();

  if (!session.authenticated) {
    const status = session.error === 'api_unreachable' ? 503 : 401;
    const message =
      session.error === 'api_unreachable'
        ? 'API недоступен'
        : 'Unauthorized';
    return {
      ok: false,
      response: NextResponse.json({ message }, { status }),
    };
  }

  const staff = session.staff;
  if (!staff?.isSuperAdmin && !staff?.sections?.includes(section)) {
    return {
      ok: false,
      response: NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true };
}
