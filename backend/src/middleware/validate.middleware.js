import { ApiError } from "../utils/ApiError.js";

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const details = result.error.flatten();
      return next(ApiError.badRequest("Validation failed", details));
    }

    if (result.data.body) req.body = result.data.body;
    if (result.data.query) req.validatedQuery = result.data.query;
    if (result.data.params) req.params = result.data.params;
    next();
  };
}
