import express from "express";
import { signUp, login } from "./auth.controller";

const router = express.Router();

router.post("/signup", signUp);
router.post("/login", login);
// console.log("Auth routes loaded");

export default router;