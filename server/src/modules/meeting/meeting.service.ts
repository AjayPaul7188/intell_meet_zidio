import redis from "../../config/redis";
import Meeting from "./meeting.model";

export const createMeeting = async (data: any, userId: string) => {
  const meeting = await Meeting.create({
    ...data,
    host: userId,
    participants: [userId],
  });

  await redis.del(`meetings:${userId}`);

  return meeting;
};


export const getMeetings = async (userId: string) => {
  const cacheKey = `meetings:${userId}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log("Cache hit");
    return JSON.parse(cached);
  }

  // DB call
  const meetings = await Meeting.find({
    participants: userId,
  });

  // Save to cache 
  await redis.set(cacheKey, JSON.stringify(meetings), "EX", 60);

  return meetings;
};