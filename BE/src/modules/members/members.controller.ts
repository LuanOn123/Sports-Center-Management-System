import { Request, Response, NextFunction } from "express";
import * as membersService from "./members.service.js";
import { sendSuccess } from "../../utils/response.js";

export async function listMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const { members, pagination } = await membersService.listMembers(req.query as any);
    sendSuccess(res, members, "Members retrieved successfully", 200, pagination);
  } catch (err) { next(err); }
}

export async function getMemberById(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await membersService.getMemberById(req.params.id as string, req.user);
    sendSuccess(res, member, "Member retrieved successfully");
  } catch (err) { next(err); }
}

export async function createMember(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await membersService.createMember(req.body, req.user);
    sendSuccess(res, member, "Member created successfully", 201);
  } catch (err) { next(err); }
}


export async function updateMember(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await membersService.updateMember(req.params.id as string, req.body);
    sendSuccess(res, member, "Member updated successfully");
  } catch (err) { next(err); }
}

export async function getMembershipStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await membersService.getMembershipStatus(req.params.id as string);
    sendSuccess(res, status, "Membership status retrieved successfully");
  } catch (err) { next(err); }
}
