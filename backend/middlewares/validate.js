const { ZodError } = require("zod");

function validate(schema) {
  return (req, res, next) => {
    try {
      req.validated = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
        });
      }
      next(error);
    }
  };
}

module.exports = validate;
