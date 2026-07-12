import { z } from "zod"; import { ROLES } from "../../core/auth.js";
export const loginSchema=z.object({email:z.string().trim().email(),password:z.string().min(1)});
export const createUserSchema=z.object({email:z.string().trim().email(),password:z.string().min(8,"Password must be at least 8 characters"),role:z.enum(ROLES as [string,...string[]])});
