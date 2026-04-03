import User from "./auth.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { error } from "node:console";

const JWT_SECRET = process.env.JWT_SECRET as string;

export const registerUser = async (data: any) => {
    const { name, email, password } = data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new Error("User already exists");
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
        name,
        email,
        password: hashedPassword,
    });

    return user;
}

export const loginUser = async (data: any) => {
    const { email, password } = data;

    const user = await User.findOne(email);
    if (!user) {
        throw new Error("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error("Invalid credentials");
    }

    const accessToken = jwt.sign(
        { userId: user._id },
        JWT_SECRET,
        { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
        { userId: user._id },
        JWT_SECRET,
        { expiresIn: "7d" }
    );

    return { user, accessToken, refreshToken };
}