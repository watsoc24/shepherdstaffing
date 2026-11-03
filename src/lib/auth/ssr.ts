import type { GetServerSidePropsContext } from "next";
import { getAuth } from "./guards";
import { publicUser } from "./service";
import type { Role } from "../../generated/prisma/client";

/**
 * getServerSideProps guard for dashboard pages: redirects to /login when
 * signed out (or role not allowed) and passes the user + entitlements as props.
 */
export async function requirePageAuth(ctx: GetServerSidePropsContext, roles?: Role[]) {
  const auth = await getAuth(ctx.req, ctx.res);
  if (!auth || !auth.user.emailVerified) {
    return { redirect: { destination: `/login?next=${encodeURIComponent(ctx.resolvedUrl)}`, permanent: false } } as const;
  }
  if (roles && !roles.includes(auth.user.role)) {
    return { redirect: { destination: "/dashboard", permanent: false } } as const;
  }
  return {
    props: {
      user: JSON.parse(JSON.stringify(publicUser(auth.user))),
      entitlements: JSON.parse(JSON.stringify(auth.entitlements)),
    },
  };
}
