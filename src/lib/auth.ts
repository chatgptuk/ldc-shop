import NextAuth from "next-auth"

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        {
            id: "linuxdo",
            name: "Linux DO",
            type: "oauth",
            authorization: "https://connect.linux.do/oauth2/authorize",
            token: "https://connect.linux.do/oauth2/token",
            userinfo: "https://connect.linux.do/api/user",
            issuer: "https://connect.linux.do/",
            clientId: process.env.OAUTH_CLIENT_ID,
            clientSecret: process.env.OAUTH_CLIENT_SECRET,
            profile(profile) {
                return {
                    id: String(profile.id),
                    name: profile.username || profile.name,
                    email: profile.email, // Check if Linux DO returns email
                    image: profile.avatar_url,
                    trustLevel: profile.trust_level
                }
            },
        }
    ],
    callbacks: {
        async jwt({ token, user, profile }) {
            if (profile) {
                token.id = String(profile.id)
                token.username = profile.username
                token.trustLevel = profile.trust_level
                token.avatar_url = profile.avatar_url
            }
            return token
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id as string
                // @ts-ignore
                session.user.username = token.username
                // @ts-ignore
                session.user.trustLevel = token.trustLevel
                // @ts-ignore
                session.user.avatar_url = token.avatar_url
            }
            return session
        }
    },

})
