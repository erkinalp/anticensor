import { MessageCreateCloudAttachment, UploadAttachmentRequest } from "@harmony/schemas";
import { makeUploadURLs } from "@harmony/api";
import { Channel, User } from "@harmony/util";

export async function uploadFiles(user: User, channel: Channel, files: Express.Multer.File[]) {
    if (files.length === 0) return [];
    const urls = await makeUploadURLs(
        user,
        channel,
        files.map((file, i) => {
            return {
                filename: file.originalname ?? "file",
                file_size: file.size,
                id: i + "",
                original_content_type: file.mimetype,
            } satisfies UploadAttachmentRequest;
        }),
    );

    return await Promise.all(
        files.map(async (file, i) => {
            const { upload_url, upload_filename } = urls.attachments[i];
            const res = await fetch(upload_url, {
                body: file.buffer,
                method: "PUT",
                headers: { "Content-type": "application/octet-stream" },
            });
            if (res.ok) {
                return { filename: file.originalname, uploaded_filename: upload_filename, original_content_type: file.mimetype } satisfies MessageCreateCloudAttachment;
            } else {
                throw new Error(await res.text());
            }
        }),
    );
}
