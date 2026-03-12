import type { Request, Response, NextFunction } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

export function asyncHandler<P extends ParamsDictionary = ParamsDictionary>(
  fn: (req: Request<P>, res: Response, next: NextFunction) => Promise<void>
): (req: Request<P>, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
