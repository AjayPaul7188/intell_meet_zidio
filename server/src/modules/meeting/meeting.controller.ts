import { Request, Response } from "express";
import { createMeeting, getMeetings } from "./meeting.service";

export const create = async (req: any, res: Response) => {
  try {
    const meeting = await createMeeting(req.body, req.user._id);
    res.status(201).json(meeting);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const list = async (req: any, res: Response) => {
  try {
    const meetings = await getMeetings(req.user._id);
    res.json(meetings);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};