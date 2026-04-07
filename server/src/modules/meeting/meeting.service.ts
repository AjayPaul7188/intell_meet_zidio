import Meeting from "./meeting.model";

export const createMeeting = async (data: any, userId: string) => {
  return await Meeting.create({
    ...data,
    host: userId,
    participants: [userId],
  });
};

export const getMeetings = async (userId: string) => {
  return await Meeting.find({
    participants: userId,
  }).populate("host", "name email");
};