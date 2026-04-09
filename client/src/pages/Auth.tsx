import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

import { loginUser, signupUser } from "../features/auth/api";
import { useAuthStore } from "../store/authStore";
import { connectSocket } from "../services/socket";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const setToken = useAuthStore((s) => s.setToken);

  // LOGIN
  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (res) => {
      const token = res.data.token;

      setToken(token);
      connectSocket(token);

      setError("");
      alert("Login successful");
      window.location.reload();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || "Login failed");
    },
  });

  // SIGNUP
  const signupMutation = useMutation({
    mutationFn: signupUser,
    onSuccess: () => {
      setError("");
      alert("Signup successful Please login");
      setIsLogin(true);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || "Signup failed");
    },
  });

  // Validation
  const validate = () => {
    if (!form.email.includes("@")) return "Enter valid email";
    if (form.password.length < 6)
      return "Password must be at least 6 characters";
    if (!isLogin && form.name.trim().length < 3)
      return "Name must be at least 3 characters";
    return "";
  };

  // Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (isLogin) {
      loginMutation.mutate({
        email: form.email,
        password: form.password,
      });
    } else {
      signupMutation.mutate({
        name: form.name,
        username: form.name,
        email: form.email,
        password: form.password,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <form
        onSubmit={handleSubmit}
        className="w-[350px] p-6 rounded-2xl shadow-xl bg-slate-900 border border-slate-700"
      >
        <h2 className="text-2xl font-semibold text-white mb-4 text-center">
          {isLogin ? "Login" : "Create Account"}
        </h2>

        {error && (
          <p className="text-red-400 text-sm mb-3 text-center">{error}</p>
        )}

        {!isLogin && (
          <Input
            placeholder="Full Name"
            className="mb-3"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
          />
        )}

        <Input
          type="email"
          placeholder="Email"
          className="mb-3"
          value={form.email}
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
        />

        <Input
          type="password"
          placeholder="Password"
          className="mb-4"
          value={form.password}
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
        />

        <Button
          type="submit"
          className="w-full"
          disabled={loginMutation.isPending || signupMutation.isPending}
        >
          {isLogin
            ? loginMutation.isPending
              ? "Logging in..."
              : "Login"
            : signupMutation.isPending
            ? "Creating..."
            : "Signup"}
        </Button>

        <p
          className="text-sm text-slate-400 mt-4 text-center cursor-pointer hover:text-white"
          onClick={() => {
            setError("");
            setIsLogin(!isLogin);
          }}
        >
          {isLogin
            ? "Don't have an account? Signup"
            : "Already have an account? Login"}
        </p>
      </form>
    </div>
  );
}