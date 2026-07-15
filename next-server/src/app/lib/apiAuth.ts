import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/app/lib/session";

type SessionUser = Awaited<ReturnType<typeof getCurrentUser>>;
type AuthedUser = SessionUser & { id: string; email: string };

type Failure = { ok: false; response: NextResponse };
type AuthSuccess = { ok: true; user: AuthedUser };

export async function requireUser(unauthorizedMessage: string): Promise<Failure | AuthSuccess> {
    const user = await getCurrentUser();
    // auth.ts session 콜백에서 id/email 둘 다 없으면 ""로 채워짐 — 둘 다 참이어야 로그인 상태
    if (!user?.id || !user?.email) {
        return { ok: false, response: NextResponse.json({ message: unauthorizedMessage }, { status: 401 }) };
    }
    return { ok: true, user: user as AuthedUser };
}

type OwnedRecord = { authorEmail: string | null };

type RequireOwnerOptions<T extends OwnedRecord> = {
    lookup: () => Promise<T | null>;
    unauthorizedMessage: string;
    notFoundMessage: string;
    forbiddenMessage: string;
    /** true면 소유자가 아니어도 role === 'admin'인 유저는 통과 (기본 false) */
    allowAdmin?: boolean;
};

type OwnerSuccess<T> = { ok: true; user: AuthedUser; record: T };

export async function requireOwner<T extends OwnedRecord>(
    options: RequireOwnerOptions<T>
): Promise<Failure | OwnerSuccess<T>> {
    const auth = await requireUser(options.unauthorizedMessage);
    if (!auth.ok) return auth;

    const record = await options.lookup();
    if (!record) {
        return { ok: false, response: NextResponse.json({ message: options.notFoundMessage }, { status: 404 }) };
    }

    const isAuthor = record.authorEmail === auth.user.email;
    const isAdmin = options.allowAdmin && auth.user.role === "admin";
    if (!isAuthor && !isAdmin) {
        return { ok: false, response: NextResponse.json({ message: options.forbiddenMessage }, { status: 403 }) };
    }

    return { ok: true, user: auth.user, record };
}
