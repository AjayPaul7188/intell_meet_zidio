import { api } from "../../lib/api";

export const loginUser = (data: any) =>
  api.post("/auth/login", data);

export const signupUser = (data: any) =>
  api.post("/auth/signup", data);