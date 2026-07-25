import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env['JWT_SECRET'] ?? (
	process.env['POSTGRES_URL']
		? (() => { throw new Error(
			'JWT_SECRET must be set when POSTGRES_URL is configured. ' +
			'Add it to your Vercel project settings.'
		); })()
		: 'budget-tracker-dev-secret-change-in-production'
);

export function hashPassword(password: string): string {
	return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
	return bcrypt.compareSync(password, hash);
}

export function createToken(userId: number, username: string): string {
	return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: number; username: string } | null {
	try {
		return jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
	} catch {
		return null;
	}
}
