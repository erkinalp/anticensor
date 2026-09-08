import { Channel, Config, User, CloudAttachment } from "#harmony/util";
import { UploadAttachmentRequestSchema, UploadAttachmentResponseSchema } from "#harmony/schemas";

import { randomString } from "#harmony/api";
import { HTTPError } from "#util/util/lambert-server";
export async function makeUploadURLs(user: User, channel: Channel, files: UploadAttachmentRequestSchema["files"]) {
    const cdnUrl = Config.get().cdn.endpointPublic;
    const batchId = `CLOUD_${user.id}_${randomString(128)}`;

    // validate IDs
    const seenIds: (string | undefined)[] = [];
    const max = Config.get().cdn.maxAttachmentSize;
    for (const file of files) {
        if (seenIds.includes(file.id)) {
            throw new HTTPError(`Duplicate attachment ID: ${file.id}`);
        }
        if (file.file_size > max) {
            throw new Error("File too large");
        }
        seenIds.push(file.id);
    }

    const attachments = await Promise.all(
        files.map(async (attachment) => {
            attachment.filename = attachment.filename.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._]+/g, "");
            const uploadFilename = `${channel.id}/${batchId}/${attachment.id ?? "0"}/${attachment.filename}`;
            const newAttachment = CloudAttachment.create({
                user: user,
                channel: channel,
                uploadFilename: uploadFilename,
                userAttachmentId: attachment.id ?? "0",
                userFilename: attachment.filename,
                userFileSize: attachment.file_size,
                userIsClip: attachment.is_clip,
                userOriginalContentType: attachment.original_content_type,
            });
            await newAttachment.save();
            return newAttachment;
        }),
    );
    return {
        attachments: attachments.map((a) => {
            return {
                id: a.userAttachmentId,
                upload_filename: a.uploadFilename,
                upload_url: `${cdnUrl}/attachments/${a.uploadFilename}`,
                original_content_type: a.userOriginalContentType,
            };
        }),
    } satisfies UploadAttachmentResponseSchema;
}
