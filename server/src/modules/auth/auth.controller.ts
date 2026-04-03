import { Request, Response } from "express";
import { registerUser, loginUser } from "./auth.service";
import { error } from "node:console";

export const signUp = async (req: Request, res: Response) => {
    try {
        const user = await registerUser(req.body);
        res.status(201).json(user);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const data = await loginUser(req.body);
        res.status(200).json(data);
    } catch (error: any) {
        res.status(400).json({message: error.message});
    }
};