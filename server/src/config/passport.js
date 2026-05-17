import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			callbackURL: process.env.GOOGLE_CALLBACK_URL,
		},
		async (accessToken, refreshToken, profile, done) => {
			try {
				let user = await User.findOne({ googleId: profile.id });
				if (!user) {
					user = await User.findOne({ email: profile.emails[0].value });
					if (user) {
						user.googleId = profile.id;
						await user.save();
					} else {
						user = await User.create({
							name: profile.displayName,
							email: profile.emails[0].value,
							avatar: profile.photos[0]?.value,
							googleId: profile.id,
							isVerified: true,
						});
					}
				}
				return done(null, user);
			} catch (err) {
				return done(err);
			}
		},
	),
);

export default passport;