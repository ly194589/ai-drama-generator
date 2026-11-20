import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// 上传文件 API
// POST /api/upload - 上传文件到服务器
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'image'; // image, audio, video, reference

    if (!file) {
      return NextResponse.json(
        { error: '未提供文件' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedTypes: Record<string, string[]> = {
      image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'],
      video: ['video/mp4', 'video/webm', 'video/quicktime'],
      reference: ['image/jpeg', 'image/png', 'image/webp'],
    };

    const allowedForType = allowedTypes[type] || allowedTypes.image;
    if (!allowedForType.includes(file.type)) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${file.type}，支持: ${allowedForType.join(', ')}` },
        { status: 400 }
      );
    }

    // 验证文件大小（最大 20MB）
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `文件过大: ${(file.size / 1024 / 1024).toFixed(1)}MB，最大支持 20MB` },
        { status: 400 }
      );
    }

    // 生成唯一文件名
    const ext = file.name.split('.').pop() || 'jpg';
    const uniqueName = `${type}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    // 确定上传目录
    const uploadDir = join(process.cwd(), 'public', 'uploads', type);

    // 确保目录存在
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 读取文件内容并写入
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadDir, uniqueName);
    await writeFile(filePath, buffer);

    // 返回可访问的 URL
    const url = `/uploads/${type}/${uniqueName}`;

    return NextResponse.json({
      success: true,
      url,
      filename: uniqueName,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('[文件上传] 失败:', error);
    return NextResponse.json(
      { error: `上传失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
