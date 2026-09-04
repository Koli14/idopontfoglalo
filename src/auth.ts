import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'
import { linkPendingInvites } from '@/lib/invites'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  providers: [Google],
  pages: {
    signIn: '/bejelentkezes',
    error: '/bejelentkezes',
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
  events: {
    /**
     * Bejelentkezéskor összekötjük a felhasználót a rá váró társszervezői
     * meghívókkal. A meghívó e-mail címre szól, a Google által visszaadott cím
     * pedig igazolt, így ez biztonságos párosítás.
     */
    async signIn({ user }) {
      if (!user.email || !user.id) return

      await linkPendingInvites(user.id, user.email)
    },
  },
})
