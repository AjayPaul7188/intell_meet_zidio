import { Request, Response } from "express";
import { registerUser, loginUser } from "./auth.service";
import cloudinary from "../../config/cloudinary";

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

export const uploadAvatar = async (req: any, res: any) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = await cloudinary.uploader.upload_stream(
      { folder: "avatars" },
      async (error, result) => {
        if (error) {
          return res.status(500).json({ message: "Upload failed" });
        }

        req.user.avatar = result?.secure_url;
        await req.user.save();

        res.json({ avatar: result?.secure_url });
      }
    );

    result.end(file.buffer);
  } catch (error) {
    res.status(500).json({ message: "Error uploading avatar" });
  }
};