import { Router } from "express";
import { playbookService } from "../services/playbook.service";
import { validate } from "../middleware/validate";
import { createPlaybookSchema, updatePlaybookSchema } from "../validators/playbook.validator";
import { objectIdParamSchema } from "../validators/common.validator";
import { apiResponse } from "../utils/api-response";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.post("/", validate({ body: createPlaybookSchema }), async (req, res, next) => {
  try {
    const playbook = await playbookService.create(req.user.id, req.body);
    // Transform response for frontend
    const response = {
      ...playbook.toObject(),
      markets: playbook.markets,
      timeframe: playbook.timeframe || "",
      createdAt: playbook.createdAt.toISOString().split('T')[0],
    };
    return apiResponse.success(res, response, 201);
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const list = await playbookService.getAll(req.user.id);
    const formatted = list.map(pb => ({
      ...pb.toObject(),
      markets: pb.markets,
      timeframe: pb.timeframe || "",
      createdAt: pb.createdAt.toISOString().split('T')[0],
    }));
    return apiResponse.success(res, formatted);
  } catch (error) { next(error); }
});

router.get("/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const playbook = await playbookService.getById(req.params.id, req.user.id);
    if (!playbook) return apiResponse.notFound(res, "Playbook tidak ditemukan");
    const response = {
      ...playbook.toObject(),
      markets: playbook.markets,
      timeframe: playbook.timeframe || "",
      createdAt: playbook.createdAt.toISOString().split('T')[0],
    };
    return apiResponse.success(res, response);
  } catch (error) { next(error); }
});

router.patch("/:id", validate({ params: objectIdParamSchema, body: updatePlaybookSchema }), async (req, res, next) => {
  try {
    const playbook = await playbookService.update(req.params.id, req.user.id, req.body);
    if (!playbook) return apiResponse.notFound(res, "Playbook tidak valid atau gagal update");
    const response = {
      ...playbook.toObject(),
      markets: playbook.markets,
      timeframe: playbook.timeframe || "",
      createdAt: playbook.createdAt.toISOString().split('T')[0],
    };
    return apiResponse.success(res, response);
  } catch (error) { next(error); }
});

router.delete("/:id", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    await playbookService.archive(req.params.id, req.user.id);
    return apiResponse.success(res, { message: "Playbook Diarsipkan" });
  } catch (error) { next(error); }
});

router.post("/:id/duplicate", validate({ params: objectIdParamSchema }), async (req, res, next) => {
  try {
    const duplicated = await playbookService.duplicate(req.params.id, req.user.id);
    if (!duplicated) return apiResponse.notFound(res, "Playbook tidak ditemukan");
    const response = {
      ...duplicated.toObject(),
      markets: duplicated.markets,
      timeframe: duplicated.timeframe || "",
      createdAt: duplicated.createdAt.toISOString().split('T')[0],
    };
    return apiResponse.success(res, response, 201);
  } catch (error) { next(error); }
});

export default router;
