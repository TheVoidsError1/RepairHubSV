import { Router } from 'express';
import { AppDataSource } from '../config/data-source.js';
import { Customer } from '../entities/Customer.js';
import { Repair, RepairStatus } from '../entities/Repair.js';
import { getLineNotificationService, LineNotificationService, buildReceiptFlexMessage } from '../services/line-notification.service.js';
import { getLineRichMenuService } from '../services/line-richmenu.service.js';
import { Not, IsNull, Like } from 'typeorm';
import crypto from 'crypto';
import axios from 'axios';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { normalizePhone, validatePhone } from '../utils/phone.js';

const router = Router();

/**
 * ฟังก์ชันช่วยสำหรับจัดการ Rich Menu Actions
 */

/**
 * เช็คสถานะงานซ่อม - แสดงสถานะการซ่อมใบล่าสุดที่ยังไม่เสร็จ
 */
async function handleCheckStatus(
  userId: string,
  customer: Customer,
  lineService: LineNotificationService
) {
  try {
    const repairRepository = AppDataSource.getRepository(Repair);
    
    // ค้นหางานซ่อมที่ยังไม่เสร็จ (ไม่ใช่ completed, cancelled, picked-up) - แค่ใบล่าสุด
    const latestActiveRepair = await repairRepository.findOne({
      where: {
        customerId: customer.id,
        status: Not(RepairStatus.COMPLETED),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!latestActiveRepair) {
      // ไม่มีงานซ่อมที่กำลังดำเนินการ
      await lineService.sendCustomMessage(
        userId,
        `📋 สถานะงานซ่อม\n\n👤 คุณ ${customer.fullName || customer.firstName}\n\n✅ ไม่มีงานซ่อมที่กำลังดำเนินการ\n\n💡 หากต้องการดูประวัติการซ่อมทั้งหมด กดปุ่ม "ประวัติการซ่อม" ด้านล่าง`
      );
      return;
    }

    // สร้างข้อความแสดงสถานะงานซ่อมใบล่าสุด
    const statusLabels: Record<string, string> = {
      'in-progress': '🔧 กำลังซ่อม',
      'completed': '✅ ซ่อมเสร็จแล้ว',
      'cancelled': '❌ ยกเลิกแล้ว',
      'picked-up': '📦 รับเครื่องแล้ว',
    };
    const statusLabel = statusLabels[latestActiveRepair.status] || latestActiveRepair.status;

    const date = new Date(latestActiveRepair.createdAt).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    let message = `📋 สถานะงานซ่อม\n\n👤 คุณ ${customer.fullName || customer.firstName}\n\n`;
    message += `📦 งานซ่อมล่าสุด:\n\n`;
    message += `🔹 ${latestActiveRepair.repairNumber}\n`;
    message += `   📅 วันที่รับ: ${date}\n`;
    message += `   📱 อุปกรณ์: ${latestActiveRepair.deviceType}${latestActiveRepair.deviceModel ? ` ${latestActiveRepair.deviceModel}` : ''}\n`;
    if (latestActiveRepair.serialNumber) {
      message += `   🔢 Serial: ${latestActiveRepair.serialNumber}\n`;
    }
    message += `   📊 สถานะ: ${statusLabel}\n`;
    if (latestActiveRepair.problemDescription) {
      const problem = latestActiveRepair.problemDescription.length > 60 
        ? latestActiveRepair.problemDescription.substring(0, 60) + '...'
        : latestActiveRepair.problemDescription;
      message += `   🔧 ปัญหา: ${problem}\n`;
    }
    if (latestActiveRepair.estimatedPrice && latestActiveRepair.estimatedPrice > 0) {
      message += `   💰 ราคาประมาณการ: ${latestActiveRepair.estimatedPrice.toLocaleString('th-TH')} บาท\n`;
    }
    message += `\n💡 หากต้องการดูรายละเอียดเพิ่มเติม กรุณาติดต่อร้าน`;

    await lineService.sendCustomMessage(userId, message);
  } catch (error) {
    console.error('[LINE Webhook] Error handling check status:', error);
    await lineService.sendCustomMessage(
      userId,
      '❌ เกิดข้อผิดพลาดในการเช็คสถานะ\n\nกรุณาลองใหม่อีกครั้ง หรือติดต่อร้านโดยตรง'
    );
  }
}

/**
 * ติดต่อเรา
 */
async function handleContact(
  userId: string,
  lineService: LineNotificationService
) {
  try {
    const contactMessage = `📞 ติดต่อเรา\n\n🏪 MacFix Service\nศูนย์ซ่อมผลิตภัณฑ์ Apple มาตรฐานครบวงจร\n\n📍 ที่อยู่:\nเยื้องโรงพยาบาลทักษิณ ติดรั้วอาชีวศึกษาสุราษฎ์ธานี\nปากซอยตลาดใหม่ 41\n\n📱 เบอร์โทร: 084-615-2244\n\n💬 LINE: @macfixservice\n\n📘 Facebook:\nhttps://www.facebook.com/macfixsurat\n\n⏰ เวลาทำการ:\n09:30 - 22:00 น. เปิดทุกวัน\n\n💬 หากมีคำถามเพิ่มเติม สามารถพิมพ์ข้อความมาหาเราได้เลยค่ะ`;

    await lineService.sendCustomMessage(userId, contactMessage);
  } catch (error) {
    console.error('[LINE Webhook] Error handling contact:', error);
    await lineService.sendCustomMessage(
      userId,
      '❌ เกิดข้อผิดพลาด\n\nกรุณาลองใหม่อีกครั้ง'
    );
  }
}

/**
 * ประวัติการซ่อม - แสดง 2-3 รายการล่าสุด
 */
async function handleHistory(
  userId: string,
  customer: Customer,
  lineService: LineNotificationService
) {
  try {
    console.log(`[LINE Webhook] handleHistory: Looking for repairs for customer ${customer.id}`);
    const repairRepository = AppDataSource.getRepository(Repair);
    
    // ค้นหางานซ่อมทั้งหมด (เรียงตามวันที่ล่าสุด) - แสดง 3 รายการล่าสุด
    const recentRepairs = await repairRepository.find({
      where: {
        customerId: customer.id,
      },
      order: {
        createdAt: 'DESC',
      },
      take: 3, // แสดง 3 รายการล่าสุด
    });

    console.log(`[LINE Webhook] handleHistory: Found ${recentRepairs.length} repairs for customer ${customer.id}`);

    if (recentRepairs.length === 0) {
      console.log(`[LINE Webhook] handleHistory: No repairs found, sending empty message`);
      await lineService.sendCustomMessage(
        userId,
        `📜 ประวัติการซ่อม\n\n👤 คุณ ${customer.fullName || customer.firstName}\n\n📭 ยังไม่มีประวัติการซ่อม\n\n💡 หากต้องการรับบริการซ่อม กรุณานำเครื่องมาที่ร้านหรือติดต่อเรา`
      );
      return;
    }

    // สร้างข้อความแสดงประวัติ
    let message = `📜 ประวัติการซ่อม\n\n👤 คุณ ${customer.fullName || customer.firstName}\n\n`;
    message += `📦 งานซ่อมล่าสุด (${recentRepairs.length} รายการ):\n\n`;

    const statusLabels: Record<string, string> = {
      'in-progress': '🔧 กำลังซ่อม',
      'completed': '✅ ซ่อมเสร็จแล้ว',
      'cancelled': '❌ ยกเลิกแล้ว',
      'picked-up': '📦 รับเครื่องแล้ว',
    };

    for (let i = 0; i < recentRepairs.length; i++) {
      const repair = recentRepairs[i];
      const statusLabel = statusLabels[repair.status] || repair.status;
      const date = new Date(repair.createdAt).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      message += `${i + 1}. ${repair.repairNumber}\n`;
      message += `   📅 วันที่: ${date}\n`;
      message += `   📱 อุปกรณ์: ${repair.deviceType}${repair.deviceModel ? ` ${repair.deviceModel}` : ''}\n`;
      message += `   📊 สถานะ: ${statusLabel}\n`;
      if (repair.totalCost > 0) {
        message += `   💰 ราคา: ${repair.totalCost.toLocaleString('th-TH')} บาท\n`;
      }
      message += `\n`;
    }

    // นับจำนวนงานซ่อมทั้งหมด
    const totalCount = await repairRepository.count({
      where: {
        customerId: customer.id,
      },
    });

    if (totalCount > recentRepairs.length) {
      message += `📊 รวมทั้งหมด ${totalCount} รายการ\n\n`;
    }

    message += `💡 หากต้องการดูรายละเอียดเพิ่มเติม กรุณาติดต่อร้าน`;

    await lineService.sendCustomMessage(userId, message);
  } catch (error) {
    console.error('[LINE Webhook] Error handling history:', error);
    await lineService.sendCustomMessage(
      userId,
      '❌ เกิดข้อผิดพลาดในการดึงประวัติ\n\nกรุณาลองใหม่อีกครั้ง หรือติดต่อร้านโดยตรง'
    );
  }
}

// Store recent webhook events for debugging (in-memory, max 10 events)
interface RecentWebhookEvent {
  timestamp: Date;
  type: string;
  userId: string;
  message?: string;
}

const recentWebhookEvents: RecentWebhookEvent[] = [];

function addRecentEvent(event: RecentWebhookEvent) {
  recentWebhookEvents.unshift(event);
  if (recentWebhookEvents.length > 10) {
    recentWebhookEvents.pop();
  }
}

/**
 * LINE Webhook Endpoint
 * รับ events จาก LINE เมื่อลูกค้า Add Friend หรือส่งข้อความมา
 */

// Middleware สำหรับตรวจสอบ signature (optional แต่แนะนำ)
function validateSignature(req: any): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
  const signature = req.headers['x-line-signature'] as string;
  
  if (!channelSecret || !signature) {
    return false;
  }

  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');

  return hash === signature;
}

/**
 * Webhook endpoint สำหรับรับ events จาก LINE
 * POST /api/line/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    // ตรวจสอบ signature (ถ้าต้องการความปลอดภัยสูง)
    // if (!validateSignature(req)) {
    //   console.error('[LINE Webhook] Invalid signature');
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    const events = req.body.events || [];
    console.log(`[LINE Webhook] Received ${events.length} events`);

    for (const event of events) {
      const userId = event.source?.userId;
      
      if (!userId) {
        console.warn('[LINE Webhook] Event without userId:', event.type);
        continue;
      }

      console.log(`[LINE Webhook] Event: ${event.type}, User ID: ${userId}`);

      // บันทึก event สำหรับ debugging
      addRecentEvent({
        timestamp: new Date(),
        type: event.type,
        userId: userId,
        message: event.message?.type === 'text' ? event.message.text : undefined,
      });

      // กรณี: ลูกค้า Add Friend LINE OA
      if (event.type === 'follow') {
        console.log(`[LINE Webhook] New follower: ${userId}`);
        
        // ส่งข้อความต้อนรับ
        const lineService = getLineNotificationService();
        if (lineService) {
          await lineService.sendCustomMessage(
            userId,
            '👋 สวัสดีค่ะ! ขอบคุณที่เพิ่มเราเป็นเพื่อน\n\n📱 กรุณาส่งเบอร์โทรศัพท์ของคุณ (10 หลัก)\nเพื่อเชื่อมโยงบัญชีและรับการแจ้งเตือนสถานะการซ่อม\n\nตัวอย่าง: 0812345678'
          );
        }
      }

      // กรณี: ลูกค้าส่งข้อความมา
      if (event.type === 'message' && event.message?.type === 'text') {
        const messageText = event.message.text;
        console.log(`[LINE Webhook] Message from ${userId}: ${messageText}`);

        // ตรวจสอบว่าเป็นเบอร์โทรหรือไม่ (รองรับรูปแบบ +66, 0, 66)
        const isPhoneNumber = validatePhone(messageText.trim());

        if (isPhoneNumber) {
          // Normalize phone number (convert +66 to 0, etc.)
          const phone = normalizePhone(messageText.trim());
          console.log(`[LINE Webhook] Detected phone number: ${messageText.trim()} -> normalized: ${phone}`);

          // ค้นหาลูกค้าจากเบอร์โทร
          const customerRepository = AppDataSource.getRepository(Customer);
          const customer = await customerRepository.findOne({
            where: { phone },
          });

          if (customer) {
            // บันทึก LINE User ID ลงในฐานข้อมูล
            customer.lineIdRes = userId;
            await customerRepository.save(customer);

            console.log(`[LINE Webhook] Linked user ${userId} to customer ${customer.id} (${customer.firstName})`);

            // ส่งข้อความยืนยัน
            const lineService = getLineNotificationService();
            if (lineService) {
              const customerName = customer.fullName || 
                                  `${customer.firstName} ${customer.lastName || ''}`.trim();
              await lineService.sendCustomMessage(
                userId,
                `✅ เชื่อมโยงบัญชีสำเร็จ!\n\n👤 คุณ ${customerName}\n📱 เบอร์โทร: ${phone}\n\n🔔 ตอนนี้คุณจะได้รับการแจ้งเตือนสถานะการซ่อมอัตโนมัติทางไลน์นี้`
              );
            }
          } else {
            console.log(`[LINE Webhook] No customer found with phone: ${phone}`);

            // แจ้งลูกค้าว่าไม่พบข้อมูล
            const lineService = getLineNotificationService();
            if (lineService) {
              await lineService.sendCustomMessage(
                userId,
                '❌ ไม่พบข้อมูลลูกค้าจากเบอร์โทรนี้\n\n📞 กรุณาติดต่อร้านเพื่อลงทะเบียนก่อน หรือตรวจสอบว่าเบอร์โทรถูกต้อง'
              );
            }
          }
        } else {
          // ข้อความไม่ใช่เบอร์โทร - ตรวจสอบว่ามีคำสั่งพิเศษหรือไม่
          const messageTextLower = messageText.trim().toLowerCase();
          const lineService = getLineNotificationService();
          
          if (!lineService) {
            continue;
          }

          // ค้นหาลูกค้าจาก LINE User ID (ถ้าเชื่อมโยงแล้ว)
          const customerRepository = AppDataSource.getRepository(Customer);
          const customer = await customerRepository.findOne({
            where: { lineIdRes: userId },
          });

          // ตรวจสอบคำสั่งพิเศษ
          if (messageTextLower.includes('ประวัติ') || messageTextLower.includes('ประวัติการซ่อม') || messageTextLower === 'history') {
            // ประวัติการซ่อม
            if (customer) {
              await handleHistory(userId, customer, lineService);
            } else {
              await lineService.sendCustomMessage(
                userId,
                '❌ ยังไม่ได้เชื่อมโยงบัญชี\n\n📱 กรุณาส่งเบอร์โทรศัพท์ของคุณ (10 หลัก)\nเพื่อเชื่อมโยงบัญชีและใช้งาน Rich Menu\n\nตัวอย่าง: 0812345678'
              );
            }
          } else if (messageTextLower.includes('สถานะ') || messageTextLower.includes('เช็คสถานะ') || messageTextLower.includes('check') || messageTextLower === 'status') {
            // เช็คสถานะงานซ่อม
            if (customer) {
              await handleCheckStatus(userId, customer, lineService);
            } else {
              await lineService.sendCustomMessage(
                userId,
                '❌ ยังไม่ได้เชื่อมโยงบัญชี\n\n📱 กรุณาส่งเบอร์โทรศัพท์ของคุณ (10 หลัก)\nเพื่อเชื่อมโยงบัญชีและใช้งาน Rich Menu\n\nตัวอย่าง: 0812345678'
              );
            }
          } else if (messageTextLower.includes('ติดต่อ') || messageTextLower.includes('contact')) {
            // ติดต่อเรา
            await handleContact(userId, lineService);
          } else {
            // ข้อความอื่นๆ - แนะนำให้ส่งเบอร์โทรหรือใช้ Rich Menu
            if (customer) {
              await lineService.sendCustomMessage(
                userId,
                '💬 หากต้องการดูข้อมูล สามารถใช้ปุ่ม Rich Menu ด้านล่างได้เลยค่ะ\n\n📋 หรือพิมพ์คำสั่ง:\n• "ประวัติการซ่อม" - ดูประวัติ\n• "เช็คสถานะ" - ดูสถานะงานซ่อม\n• "ติดต่อเรา" - ดูข้อมูลติดต่อ'
              );
            } else {
              await lineService.sendCustomMessage(
                userId,
                '📱 กรุณาส่งเบอร์โทรศัพท์ของคุณ (10 หลัก)\nเพื่อเชื่อมโยงบัญชีและใช้งาน Rich Menu\n\nตัวอย่าง: 0812345678\n\n💡 หรือใช้ปุ่ม Rich Menu ด้านล่างได้เลยค่ะ'
              );
            }
          }
        }
      }

      // กรณี: ลูกค้ากดปุ่ม Rich Menu (Postback Event)
      if (event.type === 'postback') {
        const postbackData = event.postback?.data || '';
        console.log(`[LINE Webhook] Postback event from ${userId}: ${postbackData}`);

        const lineService = getLineNotificationService();
        if (!lineService) {
          console.warn('[LINE Webhook] LINE service not available');
          continue;
        }

        // ค้นหาลูกค้าจาก LINE User ID
        const customerRepository = AppDataSource.getRepository(Customer);
        const customer = await customerRepository.findOne({
          where: { lineIdRes: userId },
        });

        console.log(`[LINE Webhook] Customer lookup for userId ${userId}:`, customer ? `Found: ${customer.fullName || customer.firstName}` : 'Not found');

        if (!customer) {
          // ถ้ายังไม่เชื่อมโยงบัญชี
          console.log(`[LINE Webhook] Customer not linked for userId: ${userId}`);
          await lineService.sendCustomMessage(
            userId,
            '❌ ยังไม่ได้เชื่อมโยงบัญชี\n\n📱 กรุณาส่งเบอร์โทรศัพท์ของคุณ (10 หลัก)\nเพื่อเชื่อมโยงบัญชีและใช้งาน Rich Menu\n\nตัวอย่าง: 0812345678'
          );
          continue;
        }

        // แยก action จาก postback data
        // รูปแบบ: "action=check_status" หรือ "action=contact" หรือ "action=history"
        const actionMatch = postbackData.match(/action=(\w+)/);
        const action = actionMatch ? actionMatch[1] : '';

        console.log(`[LINE Webhook] Processing action: ${action} for customer: ${customer.id}`);

        switch (action) {
          case 'check_status':
            // เช็คสถานะงานซ่อม
            console.log(`[LINE Webhook] Handling check_status for customer: ${customer.id}`);
            await handleCheckStatus(userId, customer, lineService);
            break;

          case 'contact':
            // ติดต่อเรา
            console.log(`[LINE Webhook] Handling contact`);
            await handleContact(userId, lineService);
            break;

          case 'history':
            // ประวัติการซ่อม
            console.log(`[LINE Webhook] Handling history for customer: ${customer.id}`);
            await handleHistory(userId, customer, lineService);
            break;

          default:
            console.log(`[LINE Webhook] Unknown action: ${action}, postbackData: ${postbackData}`);
            await lineService.sendCustomMessage(
              userId,
              '⚠️ ไม่รู้จักคำสั่งนี้\n\nกรุณาลองใหม่อีกครั้ง'
            );
        }
      }

      // กรณี: ลูกค้า Unfollow (ยกเลิกการเป็นเพื่อน)
      if (event.type === 'unfollow') {
        console.log(`[LINE Webhook] User unfollowed: ${userId}`);
        
        // TODO: ลบ LINE User ID ออกจากฐานข้อมูล (ถ้าต้องการ)
        // const customerRepository = AppDataSource.getRepository(Customer);
        // await customerRepository.update(
        //   { lineIdRes: userId },
        //   { lineIdRes: null }
        // );
      }
    }

    // ตอบกลับ LINE ว่าได้รับ events แล้ว (ต้องตอบภายใน 1 วินาที)
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[LINE Webhook] Error processing events:', error);
    
    // แม้จะเกิด error ก็ต้องตอบกลับ 200 OK เพื่อไม่ให้ LINE retry
    res.json({ status: 'error', message: 'Internal error' });
  }
});

/**
 * Endpoint สำหรับทดสอบ (GET)
 */
router.get('/webhook', (req, res) => {
  res.json({
    status: 'ok',
    message: 'LINE Webhook endpoint is ready',
    timestamp: new Date().toISOString(),
  });
});

/**
 * ดึงรายการ Webhook events ล่าสุด (สำหรับ debugging)
 * GET /api/line/recent-events
 */
router.get('/recent-events', async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: recentWebhookEvents,
      message: `Found ${recentWebhookEvents.length} recent events`,
    });
  } catch (error) {
    console.error('[LINE Recent Events] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch recent events',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ตรวจสอบสถานะการเชื่อมต่อ LINE
 * GET /api/line/status
 */
router.get('/status', async (req, res) => {
  try {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const hasToken = !!channelAccessToken;

    let connected = false;
    let message = '';
    let tokenPreview = '';
    let tokenLength = 0;
    let isValidFormat = false;
    let tokenValid = false;
    let tokenError = '';

    if (!hasToken) {
      message = 'LINE_CHANNEL_ACCESS_TOKEN not configured';
    } else {
      tokenLength = channelAccessToken.length;
      // แสดง preview ของ Token (4 ตัวแรก + ... + 4 ตัวสุดท้าย)
      if (tokenLength > 8) {
        tokenPreview = `${channelAccessToken.substring(0, 4)}...${channelAccessToken.substring(tokenLength - 4)}`;
      } else {
        tokenPreview = '***';
      }

      // ตรวจสอบ format ของ Token (LINE Channel Access Token มักจะยาวกว่า 100 ตัวอักษร)
      // แต่บางครั้งอาจจะสั้นกว่าได้ ขึ้นอยู่กับประเภทของ Token
      isValidFormat = tokenLength >= 20; // อย่างน้อย 20 ตัวอักษร

      // ทดสอบการเชื่อมต่อโดยการเรียก LINE API จริง ๆ
      try {
        const response = await axios.get('https://api.line.me/v2/bot/info', {
          headers: {
            'Authorization': `Bearer ${channelAccessToken}`,
          },
        });
        
        if (response.status === 200) {
          tokenValid = true;
          connected = true;
          message = `LINE service is ready. Bot name: ${response.data?.displayName || 'N/A'}`;
        }
      } catch (apiError: any) {
        tokenValid = false;
        connected = false;
        
        if (apiError.response?.status === 401) {
          tokenError = 'Channel Access Token ไม่ถูกต้องหรือหมดอายุ (401 Unauthorized)';
          message = '❌ Token authentication failed. Please check your LINE_CHANNEL_ACCESS_TOKEN in .env file';
        } else if (apiError.response?.status === 403) {
          tokenError = 'Token ไม่มีสิทธิ์เข้าถึง API นี้ (403 Forbidden)';
          message = '❌ Token does not have permission to access this API';
        } else {
          tokenError = apiError.response?.data?.message || apiError.message || 'Unknown error';
          message = `❌ Failed to verify token: ${tokenError}`;
        }
        
        console.error('[LINE Status] Token validation failed:', {
          status: apiError.response?.status,
          data: apiError.response?.data,
          message: tokenError,
        });
      }

      // ถ้า token ไม่ valid แต่ service ยัง initialize ได้
      const lineService = getLineNotificationService();
      if (lineService && !tokenValid) {
        // Service initialized แต่ token ไม่ valid
        message = tokenError || 'LINE service initialized, but token validation failed';
      } else if (!lineService) {
        message = 'Failed to initialize LINE service';
      }
    }

    res.json({
      status: 'success',
      data: {
        connected,
        hasToken,
        tokenValid,
        message,
        tokenPreview: hasToken ? tokenPreview : null,
        tokenLength: hasToken ? tokenLength : 0,
        isValidFormat: hasToken ? isValidFormat : false,
        tokenError: tokenError || null,
      },
    });
  } catch (error) {
    console.error('[LINE Status] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check LINE status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ทดสอบการส่งข้อความ
 * POST /api/line/test
 */
router.post('/test', async (req, res) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'userId and message are required',
      });
    }

    // ตรวจสอบ format ของ userId
    if (!userId.startsWith('U')) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid LINE User ID format. LINE User ID must start with "U"',
        details: 'You provided: ' + userId + '. This is not a valid LINE User ID.',
      });
    }

    const lineService = getLineNotificationService();
    if (!lineService) {
      return res.status(500).json({
        status: 'error',
        message: 'LINE service is not configured. Please set LINE_CHANNEL_ACCESS_TOKEN in .env file',
      });
    }

    // เรียก sendCustomMessage และดึง error details
    try {
      const success = await lineService.sendCustomMessage(userId, message);

      if (success) {
        res.json({
          status: 'success',
          message: 'Test message sent successfully',
        });
      } else {
        // ถ้า send ไม่สำเร็จ แต่ไม่ throw error อาจเป็นเพราะ LINE API error
        // ให้ตรวจสอบ logs ใน console
        res.status(500).json({
          status: 'error',
          message: 'Failed to send test message. Please check backend console for details.',
          possibleReasons: [
            'User ยังไม่ได้เป็นเพื่อนกับ LINE Official Account (แม้จะเห็นใน LINE Official Account Manager)',
            'User ยังไม่เคยส่งข้อความมาหา OA (ต้องมี active chat)',
            'User ได้ block หรือปิดการรับข้อความจาก OA',
            'LINE User ID ไม่ถูกต้องหรือ format ผิด',
            'Channel Access Token is invalid or expired (try restarting backend server)',
            'Rate limit exceeded (too many messages sent)',
          ],
          solution: 'ให้ User ส่งข้อความมาหา LINE OA ก่อน (เช่น ส่ง "สวัสดี") แล้วลองส่งอีกครั้ง',
        });
      }
    } catch (sendError: any) {
      // ถ้าเกิด error ระหว่างส่งข้อความ
      console.error('[LINE Test] Error during send:', sendError);
      res.status(500).json({
        status: 'error',
        message: 'Error occurred while sending message',
        error: sendError?.message || 'Unknown error',
        possibleReasons: [
          'Network error or LINE API is unreachable',
          'Invalid request format',
          'Backend server error',
        ],
      });
    }
  } catch (error) {
    console.error('[LINE Test] Error:', error);
    
    let errorMessage = 'Failed to send test message';
    let errorDetails = null;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack;
    }

    res.status(500).json({
      status: 'error',
      message: errorMessage,
      error: errorDetails,
    });
  }
});

/**
 * ดึงรายการลูกค้าที่มี LINE User ID
 * GET /api/line/customers
 */
router.get('/customers', async (req, res) => {
  try {
    const customerRepository = AppDataSource.getRepository(Customer);
    
    // ดึงลูกค้าทั้งหมดที่มี lineIdRes (LINE User ID)
    const customers = await customerRepository.find({
      where: {
        lineIdRes: Not(IsNull()),
      },
      order: {
        firstName: 'ASC',
      },
    });

    // กรองเฉพาะที่มี lineIdRes จริง ๆ (ไม่ใช่ empty string)
    const customersWithLine = customers.filter(c => c.lineIdRes && c.lineIdRes.trim() !== '');

    // Format response
    const formattedCustomers = customersWithLine.map(customer => ({
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      fullName: customer.fullName,
      phone: customer.phone,
      lineId: customer.lineId,
      lineIdRes: customer.lineIdRes,
    }));

    res.json({
      status: 'success',
      data: formattedCustomers,
    });
  } catch (error) {
    console.error('[LINE Customers] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch customers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * เชื่อมโยง LINE User ID กับลูกค้าด้วยตนเอง
 * POST /api/line/link-customer
 * Body: { customerId: string, lineUserId: string }
 */
router.post('/link-customer', async (req, res) => {
  try {
    const { customerId, lineUserId } = req.body;

    if (!customerId || !lineUserId) {
      return res.status(400).json({
        status: 'error',
        message: 'customerId and lineUserId are required',
      });
    }

    if (!lineUserId.startsWith('U')) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid LINE User ID format. LINE User ID must start with "U"',
      });
    }

    const customerRepository = AppDataSource.getRepository(Customer);
    
    // ตรวจสอบว่าลูกค้ามีอยู่จริง
    const customer = await customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found',
      });
    }

    // ตรวจสอบว่า LINE User ID นี้ถูกใช้โดยลูกค้าคนอื่นแล้วหรือไม่
    const existingCustomer = await customerRepository.findOne({
      where: { lineIdRes: lineUserId },
    });

    if (existingCustomer && existingCustomer.id !== customerId) {
      const existingName = existingCustomer.fullName || 
                          `${existingCustomer.firstName} ${existingCustomer.lastName || ''}`.trim();
      return res.status(409).json({
        status: 'error',
        message: `LINE User ID นี้ถูกใช้โดยลูกค้าคนอื่นแล้ว: ${existingName} (${existingCustomer.phone || 'ไม่มีเบอร์'})`,
      });
    }

    // บันทึก LINE User ID
    customer.lineIdRes = lineUserId;
    await customerRepository.save(customer);

    const customerName = customer.fullName || 
                        `${customer.firstName} ${customer.lastName || ''}`.trim();

    console.log(`[LINE Manual Link] Linked user ${lineUserId} to customer ${customer.id} (${customerName})`);

    // ส่งข้อความยืนยันให้ลูกค้า
    const lineService = getLineNotificationService();
    if (lineService) {
      try {
        await lineService.sendCustomMessage(
          lineUserId,
          `✅ เชื่อมโยงบัญชีสำเร็จ!\n\n👤 คุณ ${customerName}\n📱 เบอร์โทร: ${customer.phone || 'ไม่มีเบอร์'}\n\n🔔 ตอนนี้คุณจะได้รับการแจ้งเตือนสถานะการซ่อมอัตโนมัติทางไลน์นี้`
        );
      } catch (sendError) {
        console.error('[LINE Manual Link] Failed to send confirmation message:', sendError);
        // ไม่ throw error เพราะการเชื่อมโยงสำเร็จแล้ว
      }
    }

    res.json({
      status: 'success',
      message: 'เชื่อมโยง LINE User ID สำเร็จ',
      data: {
        customerId: customer.id,
        customerName,
        lineUserId,
      },
    });
  } catch (error) {
    console.error('[LINE Manual Link] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to link LINE User ID',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ยกเลิกการเชื่อมโยง LINE User ID
 * POST /api/line/unlink-customer
 * Body: { customerId: string }
 */
router.post('/unlink-customer', async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        status: 'error',
        message: 'customerId is required',
      });
    }

    const customerRepository = AppDataSource.getRepository(Customer);
    
    const customer = await customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found',
      });
    }

    const oldLineUserId = customer.lineIdRes;
    customer.lineIdRes = undefined;
    await customerRepository.save(customer);

    const customerName = customer.fullName || 
                        `${customer.firstName} ${customer.lastName || ''}`.trim();

    console.log(`[LINE Manual Unlink] Unlinked LINE User ID from customer ${customer.id} (${customerName})`);

    res.json({
      status: 'success',
      message: 'ยกเลิกการเชื่อมโยงสำเร็จ',
      data: {
        customerId: customer.id,
        customerName,
        oldLineUserId,
      },
    });
  } catch (error) {
    console.error('[LINE Manual Unlink] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to unlink LINE User ID',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ============================================
 * CUSTOMER MANAGEMENT API
 * ============================================
 */

// Note: validatePhone is now imported from utils/phone.ts

/**
 * ค้นหาลูกค้า
 * GET /api/line/customers/search?q=searchTerm
 */
router.get('/customers/search', async (req, res) => {
  try {
    const { q } = req.query;
    const customerRepository = AppDataSource.getRepository(Customer);
    
    // ถ้าไม่มี query หรือ query ว่าง ให้ดึงลูกค้าทั้งหมด (จำกัด 50 รายการ)
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      const customers = await customerRepository.find({
        relations: ['repairs'],
        order: { createdAt: 'DESC' },
        take: 50,
      });

      return res.json({
        status: 'success',
        data: customers,
        count: customers.length,
      });
    }

    const searchTerm = q.trim();
    
    // Try to normalize phone number if it's a valid phone format
    // This allows searching with +66 format to find normalized phone (0)
    let normalizedSearchTerm = searchTerm;
    if (validatePhone(searchTerm)) {
      normalizedSearchTerm = normalizePhone(searchTerm);
    }
    
    // ค้นหาตามชื่อ (firstName, lastName, fullName) หรือเบอร์โทร
    // Search both original and normalized phone to support both formats
    const customers = await customerRepository.find({
      where: [
        { firstName: Like(`%${searchTerm}%`) },
        { lastName: Like(`%${searchTerm}%`) },
        { fullName: Like(`%${searchTerm}%`) },
        { phone: Like(`%${searchTerm}%`) },
        ...(normalizedSearchTerm !== searchTerm ? [{ phone: Like(`%${normalizedSearchTerm}%`) }] : []),
      ],
      relations: ['repairs'],
      order: { createdAt: 'DESC' },
      take: 50,
    });

    res.json({
      status: 'success',
      data: customers,
      count: customers.length,
    });
  } catch (error) {
    console.error('[LINE Customer Search] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search customers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ดึงข้อมูลลูกค้าแบบละเอียด (พร้อมประวัติการซ่อม)
 * GET /api/line/customers/:id
 */
router.get('/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customerRepository = AppDataSource.getRepository(Customer);
    
    const customer = await customerRepository.findOne({
      where: { id },
      relations: ['repairs'],
    });

    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลลูกค้า',
      });
    }

    // เรียงลำดับงานซ่อมตามวันที่ (ใหม่สุดก่อน)
    if (customer.repairs) {
      customer.repairs.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    res.json({
      status: 'success',
      data: customer,
    });
  } catch (error) {
    console.error('[LINE Customer Detail] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch customer details',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * สร้างลูกค้าใหม่
 * POST /api/line/customers
 * Body: { firstName: string, lastName?: string, fullName?: string, phone?: string, lineId?: string }
 */
router.post('/customers', async (req, res) => {
  try {
    const { firstName, lastName, fullName, phone, lineId } = req.body;

    // Validation
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'ชื่อจำเป็นต้องระบุ',
      });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({
        status: 'error',
        message: 'รูปแบบเบอร์โทรไม่ถูกต้อง (ควรเป็น 9-10 หลัก)',
      });
    }

    const customerRepository = AppDataSource.getRepository(Customer);
    
    // Normalize phone number if provided
    const normalizedPhone = phone ? normalizePhone(phone.trim()) : null;
    
    // ตรวจสอบว่าเบอร์โทรซ้ำหรือไม่
    if (normalizedPhone) {
      const existingCustomer = await customerRepository.findOne({
        where: { phone: normalizedPhone },
      });
      if (existingCustomer) {
        return res.status(400).json({
          status: 'error',
          message: 'เบอร์โทรนี้ถูกใช้งานแล้ว',
        });
      }
    }

    const newCustomer = customerRepository.create({
      firstName: firstName.trim(),
      lastName: lastName?.trim() || undefined,
      fullName: fullName?.trim() || undefined,
      phone: normalizedPhone || undefined,
      lineId: lineId?.trim() || undefined,
    });

    const savedCustomer = await customerRepository.save(newCustomer);

    res.status(201).json({
      status: 'success',
      data: savedCustomer,
      message: 'เพิ่มลูกค้าสำเร็จ',
    });
  } catch (error) {
    console.error('[LINE Create Customer] Error:', error);
    
    // จัดการข้อผิดพลาดจากฐานข้อมูล
    if (error instanceof Error && error.message.includes('duplicate')) {
      return res.status(400).json({
        status: 'error',
        message: 'ข้อมูลลูกค้านี้มีอยู่แล้ว',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to create customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * อัพเดทข้อมูลลูกค้า
 * PUT /api/line/customers/:id
 * Body: { firstName?: string, lastName?: string, fullName?: string, phone?: string, lineId?: string }
 */
router.put('/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, fullName, phone, lineId } = req.body;
    
    const customerRepository = AppDataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({ where: { id } });

    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลลูกค้า',
      });
    }

    // Validation
    if (firstName !== undefined && (!firstName || !firstName.trim())) {
      return res.status(400).json({
        status: 'error',
        message: 'ชื่อไม่สามารถเป็นค่าว่างได้',
      });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({
        status: 'error',
        message: 'รูปแบบเบอร์โทรไม่ถูกต้อง (ควรเป็น 9-10 หลัก)',
      });
    }

    // Normalize phone number if provided
    const normalizedPhone = phone ? normalizePhone(phone.trim()) : null;
    
    // ตรวจสอบว่าเบอร์โทรซ้ำหรือไม่ (ยกเว้นลูกค้าคนนี้)
    if (normalizedPhone) {
      const existingCustomer = await customerRepository.findOne({
        where: { phone: normalizedPhone },
      });
      if (existingCustomer && existingCustomer.id !== id) {
        return res.status(400).json({
          status: 'error',
          message: 'เบอร์โทรนี้ถูกใช้งานโดยลูกค้าคนอื่นแล้ว',
        });
      }
    }

    // อัพเดทเฉพาะฟิลด์ที่ระบุ
    if (firstName !== undefined) customer.firstName = firstName.trim();
    if (lastName !== undefined) customer.lastName = lastName?.trim() || undefined;
    if (fullName !== undefined) customer.fullName = fullName?.trim() || undefined;
    if (phone !== undefined) customer.phone = normalizedPhone || undefined;
    if (lineId !== undefined) customer.lineId = lineId?.trim() || undefined;

    const updatedCustomer = await customerRepository.save(customer);

    res.json({
      status: 'success',
      data: updatedCustomer,
      message: 'อัพเดทข้อมูลลูกค้าสำเร็จ',
    });
  } catch (error) {
    console.error('[LINE Update Customer] Error:', error);
    
    // จัดการข้อผิดพลาดจากฐานข้อมูล
    if (error instanceof Error && error.message.includes('duplicate')) {
      return res.status(400).json({
        status: 'error',
        message: 'ข้อมูลลูกค้านี้มีอยู่แล้ว',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to update customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ส่งข้อความให้ลูกค้าผ่าน LINE
 * POST /api/line/customers/:id/send-message
 * Body: { message: string }
 */
router.post('/customers/:id/send-message', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'ข้อความจำเป็นต้องระบุ',
      });
    }

    const customerRepository = AppDataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({
      where: { id },
    });

    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลลูกค้า',
      });
    }

    if (!customer.lineIdRes) {
      return res.status(400).json({
        status: 'error',
        message: 'ลูกค้ายังไม่ได้เชื่อมโยงบัญชี LINE',
      });
    }

    const lineService = getLineNotificationService();
    if (!lineService) {
      return res.status(500).json({
        status: 'error',
        message: 'LINE service is not configured',
      });
    }

    const success = await lineService.sendCustomMessage(
      customer.lineIdRes,
      message.trim()
    );

    if (success) {
      const customerName = customer.fullName || 
                          `${customer.firstName} ${customer.lastName || ''}`.trim();
      
      console.log(`[LINE Send Message] Sent message to customer ${customer.id} (${customerName})`);

      res.json({
        status: 'success',
        message: 'ส่งข้อความสำเร็จ',
        data: {
          customerId: customer.id,
          customerName,
          lineUserId: customer.lineIdRes,
        },
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to send message. Please check backend console for details.',
      });
    }
  } catch (error) {
    console.error('[LINE Send Message] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send message',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ส่งใบเสร็จรับเงินให้ลูกค้าผ่าน LINE (Manual)
 * POST /api/line/customers/:id/send-receipt
 * Body: { receiptNo, date, items: [{description, quantity, unitPrice}], note? }
 */
router.post('/customers/:id/send-receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const { receiptNo, date, items, note } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณาระบุรายการสินค้า/บริการอย่างน้อย 1 รายการ',
      });
    }

    const customerRepository = AppDataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({ where: { id } });

    if (!customer) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูลลูกค้า' });
    }

    if (!customer.lineIdRes) {
      return res.status(400).json({
        status: 'error',
        message: 'ลูกค้ายังไม่ได้เชื่อมโยงบัญชี LINE',
      });
    }

    const lineService = getLineNotificationService();
    if (!lineService) {
      return res.status(500).json({ status: 'error', message: 'LINE service is not configured' });
    }

    const customerName = customer.fullName || `${customer.firstName} ${customer.lastName || ''}`.trim();
    const today = date || new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const receiptNumber = receiptNo || `R-${Date.now()}`;

    // คำนวณยอดรวม
    const totalAmount = items.reduce((sum: number, item: any) => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);

    // สร้าง Flex Message ใบเสร็จรับเงิน
    const receiptFlexItems = items.map((item: any) => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unitPrice) || 0;
      return {
        itemCode: item.itemCode || '',
        description: item.description || 'รายการบริการ',
        quantity: qty,
        unitPrice: price,
        amount: qty * price,
      };
    });

    const flexMessage = buildReceiptFlexMessage({
      shopName: 'Macfix Service',
      shopAddress: 'ตรงข้าม รพ.ทักษิณ ต.ตลาด อ.เมือง จ.สุราษฎร์ธานี',
      shopPhone: 'โทร. 084-615-2244',
      receiptNo: receiptNumber,
      issueDate: today,
      customerName,
      items: receiptFlexItems,
      grandTotal: totalAmount,
      note: note || undefined,
    });

    const success = await lineService.sendFlexMessage(customer.lineIdRes, flexMessage);

    if (success) {
      console.log(`[LINE Send Receipt] Sent receipt to customer ${customer.id} (${customerName})`);
      res.json({
        status: 'success',
        message: 'ส่งใบเสร็จสำเร็จ',
        data: { customerId: customer.id, customerName, lineUserId: customer.lineIdRes, totalAmount, receiptNo: receiptNumber },
      });
    } else {
      res.status(500).json({ status: 'error', message: 'Failed to send receipt via LINE' });
    }
  } catch (error) {
    console.error('[LINE Send Receipt] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send receipt',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ส่งรูปภาพใบเสร็จให้ลูกค้าผ่าน LINE
 * POST /api/line/customers/:id/send-receipt-image
 * Body: multipart/form-data { image: File (JPEG/PNG), receiptNo?: string }
 */
// multer สำหรับรับรูปภาพใบเสร็จ (เก็บเป็น buffer)
const receiptImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  },
});

router.post('/customers/:id/send-receipt-image', receiptImageUpload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const receiptNo: string = req.body?.receiptNo || `R-${Date.now()}`;

    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'กรุณาแนบไฟล์รูปภาพ' });
    }

    // ค้นหาลูกค้า
    const customerRepository = AppDataSource.getRepository(Customer);
    const customer = await customerRepository.findOne({ where: { id } });

    if (!customer) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูลลูกค้า' });
    }

    if (!customer.lineIdRes) {
      return res.status(400).json({ status: 'error', message: 'ลูกค้ายังไม่ได้เชื่อมโยงบัญชี LINE' });
    }

    const lineService = getLineNotificationService();
    if (!lineService) {
      return res.status(500).json({ status: 'error', message: 'LINE service is not configured' });
    }

    // สร้าง directory สำหรับเก็บรูปใบเสร็จ
    const uploadsDir = path.join(process.cwd(), 'uploads', 'receipts');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // บันทึกไฟล์รูปภาพ
    const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    // สร้างชื่อไฟล์จาก receiptNo โดย sanitize อักขระพิเศษ
    const sanitizedReceiptNo = receiptNo.replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = Date.now();
    const filename = `receipt-${sanitizedReceiptNo}-${timestamp}.${ext}`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, req.file.buffer);

    // สร้าง public URL - auto-detect จาก request หรือใช้ environment variable
    let backendPublicUrl = (process.env.BACKEND_PUBLIC_URL || '').replace(/\/$/, '');
    
    // ถ้าไม่มี BACKEND_PUBLIC_URL ให้ auto-detect จาก request
    if (!backendPublicUrl) {
      // ตรวจสอบ Render environment variable
      if (process.env.RENDER_EXTERNAL_URL) {
        backendPublicUrl = process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
      } else {
        // Auto-detect จาก request headers (รองรับ reverse proxy)
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        const host = req.get('x-forwarded-host') || req.get('host') || '';
        if (host) {
          backendPublicUrl = `${protocol}://${host}`;
        }
      }
    }
    
    if (!backendPublicUrl) {
      fs.unlinkSync(filepath); // ลบไฟล์ก่อน return
      return res.status(500).json({
        status: 'error',
        message: 'ไม่สามารถสร้าง public URL ได้ กรุณาตั้งค่า BACKEND_PUBLIC_URL หรือ RENDER_EXTERNAL_URL ใน environment variables',
      });
    }

    const imageUrl = `${backendPublicUrl}/uploads/receipts/${filename}`;

    // ส่งรูปภาพไปยัง LINE
    const imageMessage = {
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    };

    const success = await lineService.sendFlexMessage(customer.lineIdRes, imageMessage);

    // ตั้ง timer ลบไฟล์หลัง 30 นาที (เพื่อไม่ให้เต็ม disk)
    setTimeout(() => {
      try {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          console.log(`[LINE Receipt Image] Cleaned up: ${filename}`);
        }
      } catch (e) {
        console.warn(`[LINE Receipt Image] Failed to clean up ${filename}:`, e);
      }
    }, 30 * 60 * 1000);

    const customerName = customer.fullName || `${customer.firstName} ${customer.lastName || ''}`.trim();

    if (success) {
      console.log(`[LINE Receipt Image] Sent to ${customerName} (${customer.lineIdRes}): ${imageUrl}`);
      res.json({
        status: 'success',
        message: 'ส่งรูปใบเสร็จสำเร็จ',
        data: { customerId: customer.id, customerName, lineUserId: customer.lineIdRes, imageUrl, receiptNo },
      });
    } else {
      fs.unlinkSync(filepath);
      res.status(500).json({ status: 'error', message: 'ไม่สามารถส่งรูปภาพไปยัง LINE ได้' });
    }
  } catch (error) {
    console.error('[LINE Receipt Image] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send receipt image',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ดึงเทมเพลตข้อความสถานะทั้งหมด
 * GET /api/line/status-templates
 */
router.get('/status-templates', async (req, res) => {
  try {
    const templates = LineNotificationService.getAllTemplates();
    
    res.json({
      status: 'success',
      data: templates,
      message: 'ดึงเทมเพลตสำเร็จ',
    });
  } catch (error) {
    console.error('[LINE Status Templates] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch status templates',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ดึงเทมเพลตข้อความสถานะเฉพาะ
 * GET /api/line/status-templates/:status
 */
router.get('/status-templates/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const template = LineNotificationService.getTemplate(status);
    
    if (!template) {
      return res.status(404).json({
        status: 'error',
        message: `ไม่พบเทมเพลตสำหรับสถานะ: ${status}`,
      });
    }

    res.json({
      status: 'success',
      data: template,
      message: 'ดึงเทมเพลตสำเร็จ',
    });
  } catch (error) {
    console.error('[LINE Status Template] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch status template',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * อัพเดทเทมเพลตข้อความสถานะ
 * PUT /api/line/status-templates/:status
 * Body: { template: string }
 */
router.put('/status-templates/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const { template } = req.body;

    if (!template || typeof template !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'template is required and must be a string',
      });
    }

    const success = LineNotificationService.updateTemplate(status, template);

    if (!success) {
      return res.status(404).json({
        status: 'error',
        message: `ไม่พบเทมเพลตสำหรับสถานะ: ${status}`,
        availableStatuses: ['in-progress', 'completed', 'cancelled', 'picked-up', 'appointment-change'],
      });
    }

    console.log(`[LINE Template Update] Updated template for status: ${status}`);

    res.json({
      status: 'success',
      message: 'อัพเดทเทมเพลตสำเร็จ',
      data: {
        status,
        template,
      },
    });
  } catch (error) {
    console.error('[LINE Template Update] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update status template',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * รีเซ็ตเทมเพลตกลับไปใช้ค่าเริ่มต้น
 * POST /api/line/status-templates/reset
 * Body: { status?: string } (ถ้าไม่ระบุจะรีเซ็ตทั้งหมด)
 */
router.post('/status-templates/reset', async (req, res) => {
  try {
    const { status } = req.body;

    if (status && typeof status !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'status must be a string',
      });
    }

    // ตรวจสอบว่าสถานะที่ระบุมีอยู่จริงหรือไม่
    if (status) {
      const template = LineNotificationService.getTemplate(status);
      if (!template) {
        return res.status(404).json({
          status: 'error',
          message: `ไม่พบเทมเพลตสำหรับสถานะ: ${status}`,
          availableStatuses: ['in-progress', 'completed', 'cancelled', 'picked-up', 'appointment-change'],
        });
      }
    }

    LineNotificationService.resetTemplate(status);

    const message = status 
      ? `รีเซ็ตเทมเพลตสำหรับสถานะ ${status} สำเร็จ` 
      : 'รีเซ็ตเทมเพลตทั้งหมดสำเร็จ';

    console.log(`[LINE Template Reset] ${message}`);

    res.json({
      status: 'success',
      message,
      data: {
        resetStatus: status || 'all',
      },
    });
  } catch (error) {
    console.error('[LINE Template Reset] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset status template',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ทดสอบการส่งข้อความด้วยเทมเพลต
 * POST /api/line/test-template
 * Body: { userId: string, status: string, customerName: string, repairNumber: string, deviceType: string, additionalInfo?: string }
 */
router.post('/test-template', async (req, res) => {
  try {
    const { userId, status, customerName, repairNumber, deviceType, additionalInfo } = req.body;

    if (!userId || !status || !customerName || !repairNumber || !deviceType) {
      return res.status(400).json({
        status: 'error',
        message: 'userId, status, customerName, repairNumber, and deviceType are required',
      });
    }

    // ตรวจสอบ format ของ userId
    if (!userId.startsWith('U')) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid LINE User ID format. LINE User ID must start with "U"',
      });
    }

    const lineService = getLineNotificationService();
    if (!lineService) {
      return res.status(500).json({
        status: 'error',
        message: 'LINE service is not configured',
      });
    }

    // สร้างข้อความจากเทมเพลต
    const message = lineService.createRepairStatusMessage(
      customerName,
      repairNumber,
      status,
      deviceType,
      additionalInfo
    );

    // ส่งข้อความ
    const success = await lineService.sendCustomMessage(userId, message);

    if (success) {
      res.json({
        status: 'success',
        message: 'ส่งข้อความทดสอบสำเร็จ',
        data: {
          userId,
          status,
          previewMessage: message,
        },
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to send test message',
      });
    }
  } catch (error) {
    console.error('[LINE Test Template] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send test message',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ============================================
 * RICH MENU API
 * ============================================
 */

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Accept only PNG and JPEG
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPEG images are allowed'));
    }
  },
});

/**
 * ดึงรายการ Rich Menu ทั้งหมด
 * GET /api/line/richmenu
 */
router.get('/richmenu', async (req, res) => {
  try {
    const richMenuService = getLineRichMenuService();
    if (!richMenuService) {
      return res.status(500).json({
        status: 'error',
        message: 'LINE Rich Menu service is not configured',
      });
    }

    const richMenuList = await richMenuService.getRichMenuList();
    
    res.json({
      status: 'success',
      data: richMenuList.richmenus,
      message: `Found ${richMenuList.richmenus.length} rich menus`,
    });
  } catch (error) {
    console.error('[LINE Rich Menu] Error getting rich menu list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get rich menu list',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ดึงข้อมูล Rich Menu ตาม ID
 * GET /api/line/richmenu/:richMenuId
 */
router.get('/richmenu/:richMenuId', async (req, res) => {
  try {
    const { richMenuId } = req.params;

    const richMenuService = getLineRichMenuService();
    if (!richMenuService) {
      return res.status(500).json({
        status: 'error',
        message: 'LINE Rich Menu service is not configured',
      });
    }

    const richMenu = await richMenuService.getRichMenu(richMenuId);
    
    res.json({
      status: 'success',
      data: richMenu,
      message: 'Rich menu retrieved successfully',
    });
  } catch (error) {
    console.error('[LINE Rich Menu] Error getting rich menu:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get rich menu',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * สร้าง Rich Menu ใหม่
 * POST /api/line/richmenu
 * Body: { size: { width, height }, selected: boolean, name: string, chatBarText: string, areas: [...] }
 */
router.post('/richmenu', async (req, res) => {
  try {
    const { size, selected, name, chatBarText, areas } = req.body;

    if (!size || !name || !chatBarText || !areas) {
      return res.status(400).json({
        status: 'error',
        message: 'size, name, chatBarText, and areas are required',
      });
    }

    const richMenuService = getLineRichMenuService();
    if (!richMenuService) {
      return res.status(500).json({
        status: 'error',
        message: 'LINE Rich Menu service is not configured',
      });
    }

    const richMenuId = await richMenuService.createRichMenu({
      size,
      selected: selected || false,
      name,
      chatBarText,
      areas,
    });
    
    res.json({
      status: 'success',
      data: { richMenuId },
      message: 'Rich menu created successfully',
    });
  } catch (error) {
    console.error('[LINE Rich Menu] Error creating rich menu:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create rich menu',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * อัพโหลดรูปภาพ Rich Menu
 * POST /api/line/richmenu/:richMenuId/image
 * FormData: { file: image }
 */
router.post('/richmenu/:richMenuId/image', upload.single('file'), async (req, res) => {
  try {
    const { richMenuId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Image file is required',
      });
    }

    const richMenuService = getLineRichMenuService();
    if (!richMenuService) {
      return res.status(500).json({
        status: 'error',
        message: 'LINE Rich Menu service is not configured',
      });
    }

    const contentType = req.file.mimetype;
    const success = await richMenuService.uploadRichMenuImageFromBuffer(
      richMenuId,
      req.file.buffer,
      contentType
    );
    
    if (success) {
      res.json({
        status: 'success',
        message: 'Rich menu image uploaded successfully',
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to upload rich menu image',
      });
    }
  } catch (error) {
    console.error('[LINE Rich Menu] Error uploading image:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload rich menu image',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ดาวน์โหลดรูปภาพ Rich Menu
 * GET /api/line/richmenu/:richMenuId/image
 */
router.get('/richmenu/:richMenuId/image', async (req, res) => {
  try {
    const { richMenuId } = req.params;

    const richMenuService = getLineRichMenuService();
    if (!richMenuService) {
      return res.status(500).json({
        status: 'error',
        message: 'LINE Rich Menu service is not configured',
      });
    }

    const imageBuffer = await richMenuService.downloadRichMenuImage(richMenuId);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="richmenu-${richMenuId}.png"`);
    res.send(imageBuffer);
  } catch (error) {
    console.error('[LINE Rich Menu] Error downloading image:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to download rich menu image',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ตั้งค่า Rich Menu เป็น default
 * POST /api/line/richmenu/:richMenuId/set-default
 */
router.post('/richmenu/:richMenuId/set-default', async (req, res) => {
  try {
    const { richMenuId } = req.params;

    const richMenuService = getLineRichMenuService();
    if (!richMenuService) {
      return res.status(500).json({
        status: 'error',
        message: 'LINE Rich Menu service is not configured',
      });
    }

    const success = await richMenuService.setDefaultRichMenu(richMenuId);
    
    if (success) {
      res.json({
        status: 'success',
        message: 'Default rich menu set successfully',
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to set default rich menu',
      });
    }
  } catch (error) {
    console.error('[LINE Rich Menu] Error setting default rich menu:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to set default rich menu',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ลบ Rich Menu default
 * DELETE /api/line/richmenu/default
 */
router.delete('/richmenu/default', async (req, res) => {
  try {
    const richMenuService = getLineRichMenuService();
    if (!richMenuService) {
      return res.status(500).json({
        status: 'error',
        message: 'LINE Rich Menu service is not configured',
      });
    }

    const success = await richMenuService.cancelDefaultRichMenu();
    
    if (success) {
      res.json({
        status: 'success',
        message: 'Default rich menu cancelled successfully',
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to cancel default rich menu',
      });
    }
  } catch (error) {
    console.error('[LINE Rich Menu] Error cancelling default rich menu:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel default rich menu',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * ลบ Rich Menu
 * DELETE /api/line/richmenu/:richMenuId
 */
router.delete('/richmenu/:richMenuId', async (req, res) => {
  try {
    const { richMenuId } = req.params;

    const richMenuService = getLineRichMenuService();
    if (!richMenuService) {
      return res.status(500).json({
        status: 'error',
        message: 'LINE Rich Menu service is not configured',
      });
    }

    const success = await richMenuService.deleteRichMenu(richMenuId);
    
    if (success) {
      res.json({
        status: 'success',
        message: 'Rich menu deleted successfully',
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete rich menu',
      });
    }
  } catch (error) {
    console.error('[LINE Rich Menu] Error deleting rich menu:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete rich menu',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
