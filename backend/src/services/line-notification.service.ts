import axios from 'axios';

/**
 * LINE Messaging Service
 * ส่งการแจ้งเตือนให้ลูกค้าผ่าน LINE Official Account
 */

interface LineNotificationConfig {
  channelAccessToken: string;
}

// เก็บเทมเพลตข้อความสถานะที่กำหนดเอง
interface StatusTemplate {
  status: string;
  template: string;
  description: string;
}

// เทมเพลตข้อความเริ่มต้น
const DEFAULT_STATUS_TEMPLATES: Record<string, StatusTemplate> = {
  'in-progress': {
    status: 'in-progress',
    template: `🔧 แจ้งเตือน: เริ่มซ่อมแล้ว!

สวัสดีคุณ {customerName}
หมายเลขงานซ่อม: {repairNumber}
อุปกรณ์: {deviceType}
สถานะ: กำลังซ่อม

ช่างของเรากำลังดำเนินการซ่อมอุปกรณ์ของคุณอยู่
วันเวลานัดรับ: {scheduledPickupTime}
{additionalInfo}`,
    description: 'ข้อความเมื่อสถานะเป็นกำลังซ่อม',
  },
  'completed': {
    status: 'completed',
    template: `✅ แจ้งเตือน: ซ่อมเสร็จแล้ว!

สวัสดีคุณ {customerName}
หมายเลขงานซ่อม: {repairNumber}
อุปกรณ์: {deviceType}
สถานะ: ซ่อมเสร็จแล้ว ✨

อุปกรณ์ของคุณซ่อมเสร็จเรียบร้อยแล้ว พร้อมรับได้ตลอดเวลา!
{additionalInfo}`,
    description: 'ข้อความเมื่อสถานะเป็นซ่อมเสร็จแล้ว',
  },
  'cancelled': {
    status: 'cancelled',
    template: `❌ แจ้งเตือน: ยกเลิกงานซ่อม

สวัสดีคุณ {customerName}
หมายเลขงานซ่อม: {repairNumber}
อุปกรณ์: {deviceType}
สถานะ: ยกเลิกแล้ว

{additionalInfo}หากมีข้อสงสัย กรุณาติดต่อเรา`,
    description: 'ข้อความเมื่อสถานะเป็นยกเลิกแล้ว',
  },
  'picked-up': {
    status: 'picked-up',
    template: `📦 แจ้งเตือน: รับเครื่องแล้ว

สวัสดีคุณ {customerName}
หมายเลขงานซ่อม: {repairNumber}
อุปกรณ์: {deviceType}
สถานะ: รับเครื่องแล้ว

ขอบคุณที่ใช้บริการของเรา 🙏
หากมีปัญหาใด ๆ กรุณาติดต่อเราได้ทันที`,
    description: 'ข้อความเมื่อสถานะเป็นรับเครื่องแล้ว',
  },
  'appointment-change': {
    status: 'appointment-change',
    template: `📅 แจ้งเตือน: เปลี่ยนแปลงวันเวลานัดรับเครื่อง

สวัสดีคุณ {customerName}
หมายเลขงานซ่อม: {repairNumber}
อุปกรณ์: {deviceType}

วันเวลานัดรับเครื่องได้ถูกเปลี่ยนแปลง:
{oldAppointmentDetails}
{newAppointmentDetails}

กรุณามารับเครื่องตามวันเวลาที่นัดหมายใหม่
หากมีข้อสงสัย กรุณาติดต่อเรา`,
    description: 'ข้อความเมื่อมีการเปลี่ยนแปลงวันเวลานัดรับเครื่อง',
  },
};

// เก็บเทมเพลตที่ผู้ใช้กำหนดเอง (in-memory)
let customStatusTemplates: Record<string, string> = {};

interface NotificationMessage {
  to: string; // LINE User ID ของลูกค้า
  messages: Array<{
    type: 'text';
    text: string;
  }>;
}

// ============================================================
// Receipt Flex Message Builder
// ============================================================

export interface ReceiptFlexItem {
  itemCode?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ReceiptFlexData {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  receiptNo: string;
  issueDate: string;
  customerName: string;
  items: ReceiptFlexItem[];
  grandTotal: number;
  note?: string;
}

function formatThaiNumber(n: number): string {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * สร้าง LINE Flex Message JSON สำหรับใบเสร็จรับเงิน
 * ดีไซน์เหมือนใบเสร็จจริง มีส่วนหัว รายการ และยอดรวม
 */
export function buildReceiptFlexMessage(data: ReceiptFlexData): object {
  const {
    shopName,
    shopAddress,
    shopPhone,
    receiptNo,
    issueDate,
    customerName,
    items,
    grandTotal,
    note,
  } = data;

  // สร้าง rows ของรายการสินค้า
  const itemRows: object[] = items.map((item) => ({
    type: 'box',
    layout: 'horizontal',
    paddingTop: '6px',
    paddingBottom: '6px',
    contents: [
      {
        type: 'text',
        text: item.itemCode || '-',
        size: 'xs',
        color: '#555555',
        flex: 2,
        wrap: true,
      },
      {
        type: 'text',
        text: item.description,
        size: 'xs',
        color: '#333333',
        flex: 5,
        wrap: true,
      },
      {
        type: 'text',
        text: String(item.quantity),
        size: 'xs',
        color: '#555555',
        align: 'center',
        flex: 1,
      },
      {
        type: 'text',
        text: formatThaiNumber(item.unitPrice),
        size: 'xs',
        color: '#555555',
        align: 'end',
        flex: 3,
      },
      {
        type: 'text',
        text: formatThaiNumber(item.amount),
        size: 'xs',
        color: '#333333',
        align: 'end',
        flex: 3,
        weight: 'bold',
      },
    ],
  }));

  // footer content
  const footerContents: object[] = [];
  if (note) {
    footerContents.push({
      type: 'text',
      text: `📝 หมายเหตุ: ${note}`,
      size: 'xs',
      color: '#888888',
      wrap: true,
      margin: 'sm',
    });
  }
  footerContents.push(
    {
      type: 'separator',
      margin: 'sm',
    },
    {
      type: 'text',
      text: '✅ ขอบคุณที่ใช้บริการ MacFix Service',
      size: 'sm',
      color: '#27AE60',
      align: 'center',
      margin: 'sm',
    },
    {
      type: 'text',
      text: '💚 หากมีปัญหาใดๆ กรุณาติดต่อเรา',
      size: 'xs',
      color: '#888888',
      align: 'center',
    }
  );

  const flexContents = {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'horizontal',
      backgroundColor: '#FFFFFF',
      paddingAll: '14px',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          flex: 5,
          contents: [
            {
              type: 'text',
              text: shopName,
              weight: 'bold',
              size: 'sm',
              color: '#222222',
            },
            {
              type: 'text',
              text: shopAddress,
              size: 'xxs',
              color: '#777777',
              wrap: true,
              margin: 'xs',
            },
            {
              type: 'text',
              text: shopPhone,
              size: 'xxs',
              color: '#777777',
            },
          ],
        },
        {
          type: 'box',
          layout: 'vertical',
          flex: 4,
          contents: [
            {
              type: 'text',
              text: 'MacFix service',
              weight: 'bold',
              size: 'md',
              color: '#1565C0',
              align: 'end',
            },
            {
              type: 'text',
              text: `เลขที่ ${receiptNo}`,
              size: 'xxs',
              color: '#555555',
              align: 'end',
              margin: 'sm',
            },
            {
              type: 'text',
              text: `วันที่ ${issueDate}`,
              size: 'xxs',
              color: '#555555',
              align: 'end',
            },
          ],
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '14px',
      spacing: 'sm',
      contents: [
        // ชื่อเอกสาร
        {
          type: 'box',
          layout: 'vertical',
          paddingTop: '4px',
          paddingBottom: '4px',
          contents: [
            {
              type: 'text',
              text: 'ใบเสร็จรับเงิน',
              weight: 'bold',
              size: 'xl',
              align: 'center',
              color: '#222222',
            },
            {
              type: 'text',
              text: 'RECEIPT',
              size: 'xs',
              align: 'center',
              color: '#E67E22',
            },
          ],
        },
        { type: 'separator' },
        // ชื่อลูกค้า
        {
          type: 'box',
          layout: 'vertical',
          paddingTop: '6px',
          paddingBottom: '6px',
          contents: [
            {
              type: 'text',
              text: 'ชื่อลูกค้า',
              size: 'xxs',
              color: '#888888',
            },
            {
              type: 'text',
              text: customerName,
              weight: 'bold',
              size: 'md',
              color: '#222222',
              margin: 'xs',
            },
          ],
        },
        { type: 'separator' },
        // Header ตาราง
        {
          type: 'box',
          layout: 'horizontal',
          backgroundColor: '#F5F5F5',
          paddingTop: '6px',
          paddingBottom: '6px',
          paddingStart: '4px',
          paddingEnd: '4px',
          contents: [
            { type: 'text', text: 'รหัส', size: 'xxs', color: '#666666', flex: 2, weight: 'bold' },
            { type: 'text', text: 'รายการ', size: 'xxs', color: '#666666', flex: 5, weight: 'bold' },
            { type: 'text', text: 'จำนวน', size: 'xxs', color: '#666666', flex: 1, align: 'center', weight: 'bold' },
            { type: 'text', text: 'ราคา/หน่วย', size: 'xxs', color: '#666666', flex: 3, align: 'end', weight: 'bold' },
            { type: 'text', text: 'รวม', size: 'xxs', color: '#666666', flex: 3, align: 'end', weight: 'bold' },
          ],
        },
        { type: 'separator' },
        // รายการสินค้า
        ...itemRows,
        { type: 'separator' },
        // ยอดรวม
        {
          type: 'box',
          layout: 'horizontal',
          paddingTop: '8px',
          paddingBottom: '4px',
          contents: [
            {
              type: 'text',
              text: 'จำนวนเงินทั้งสิ้น',
              weight: 'bold',
              size: 'sm',
              color: '#222222',
              flex: 5,
            },
            {
              type: 'text',
              text: `${formatThaiNumber(grandTotal)} บาท`,
              weight: 'bold',
              size: 'lg',
              color: '#C0392B',
              align: 'end',
              flex: 4,
            },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      backgroundColor: '#FAFAFA',
      contents: footerContents,
    },
    styles: {
      header: {
        separator: true,
      },
      footer: {
        separator: true,
      },
    },
  };

  return {
    type: 'flex',
    altText: `ใบเสร็จรับเงิน - ${customerName} - ${formatThaiNumber(grandTotal)} บาท`,
    contents: flexContents,
  };
}

export class LineNotificationService {
  private channelAccessToken: string;
  private apiUrl = 'https://api.line.me/v2/bot/message/push';

  constructor(config: LineNotificationConfig) {
    this.channelAccessToken = config.channelAccessToken;
  }

  /**
   * ส่งข้อความแจ้งเตือนไปยังลูกค้า
   */
  async sendNotification(userId: string, message: string): Promise<boolean> {
    if (!userId || !this.channelAccessToken) {
      console.warn('[LINE] Cannot send notification: Missing userId or access token');
      return false;
    }

    try {
      const payload: NotificationMessage = {
        to: userId,
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      };

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.channelAccessToken}`,
        },
      });

      if (response.status === 200) {
        console.log(`[LINE] Notification sent successfully to ${userId}`);
        return true;
      } else {
        console.error(`[LINE] Failed to send notification: ${response.status}`, response.data);
        return false;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;
        const errorMessage = data?.message || error.message;
        const details = data?.details || data;
        
        console.error('[LINE] Error sending notification:', {
          status,
          data,
          message: errorMessage,
          userId,
          fullError: JSON.stringify(data, null, 2),
        });

        // แสดง error message ที่เข้าใจง่าย
        if (status === 400) {
          console.error('[LINE] Bad Request (400) - สาเหตุที่เป็นไปได้:');
          console.error('  1. User ID ไม่ถูกต้องหรือ format ผิด');
          console.error('  2. User ยังไม่ได้เป็นเพื่อนกับ LINE Official Account');
          console.error('  3. Message format ไม่ถูกต้อง');
          console.error('  4. Request payload ไม่ถูกต้อง');
          if (details) {
            console.error('  Error Details:', JSON.stringify(details, null, 2));
          }
        } else if (status === 401) {
          console.error('[LINE] Unauthorized (401) - Channel Access Token ไม่ถูกต้องหรือหมดอายุ');
        } else if (status === 403) {
          console.error('[LINE] Forbidden (403) - User ไม่ได้เป็นเพื่อนกับ LINE Official Account');
          console.error('  วิธีแก้ไข: ให้ User เพิ่ม LINE Official Account เป็นเพื่อนก่อน');
        } else if (status === 404) {
          console.error('[LINE] Not Found (404) - User ID ไม่พบในระบบ LINE');
        } else if (status === 429) {
          console.error('[LINE] Too Many Requests (429) - ส่งข้อความบ่อยเกินไป');
        } else {
          console.error(`[LINE] Error ${status}: ${errorMessage}`);
        }
      } else {
        console.error('[LINE] Unknown error sending notification:', error);
      }
      return false;
    }
  }

  /**
   * สร้างข้อความแจ้งเตือนตามสถานะการซ่อม
   */
  createRepairStatusMessage(
    customerName: string,
    repairNumber: string,
    status: string,
    deviceType: string,
    additionalInfo?: string,
    receiveDate?: Date | string,
    receiveTime?: string,
    scheduledPickupTime?: Date | string
  ): string {
    // ดู custom templates ที่มี
    console.log('[LINE Template] Creating message for status:', status);
    console.log('[LINE Template] Available custom templates:', Object.keys(customStatusTemplates));
    console.log('[LINE Template] Has custom template for', status, ':', !!customStatusTemplates[status]);
    
    // ใช้เทมเพลตที่ผู้ใช้กำหนด หรือเทมเพลตเริ่มต้น
    let template = customStatusTemplates[status] || DEFAULT_STATUS_TEMPLATES[status]?.template;
    
    if (customStatusTemplates[status]) {
      console.log('[LINE Template] ✅ Using CUSTOM template for', status);
      console.log('[LINE Template] Preview:', template.substring(0, 150) + '...');
    } else {
      console.log('[LINE Template] ℹ️ Using DEFAULT template for', status);
    }
    
    if (!template) {
      console.warn('[LINE Template] ⚠️ No template found for status:', status);
      return `แจ้งเตือน: สถานะงานซ่อม ${repairNumber} เปลี่ยนเป็น ${status}`;
    }

    // แทนที่ตัวแปรในเทมเพลต
    let message = template
      .replace(/{customerName}/g, customerName)
      .replace(/{repairNumber}/g, repairNumber)
      .replace(/{deviceType}/g, deviceType)
      .replace(/{status}/g, status);

    // จัดการวันที่และเวลา
    if (receiveDate) {
      const dateStr = receiveDate instanceof Date 
        ? receiveDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
        : receiveDate;
      message = message.replace(/{receiveDate}/g, dateStr);
    } else {
      message = message.replace(/{receiveDate}/g, '-');
    }

    if (receiveTime) {
      message = message.replace(/{receiveTime}/g, receiveTime);
    } else {
      message = message.replace(/{receiveTime}/g, '-');
    }

    if (scheduledPickupTime) {
      const pickupStr = scheduledPickupTime instanceof Date
        ? scheduledPickupTime.toLocaleString('th-TH', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : scheduledPickupTime;
      message = message.replace(/{scheduledPickupTime}/g, pickupStr);
    } else {
      message = message.replace(/{scheduledPickupTime}/g, '-');
    }

    // จัดการ additionalInfo
    if (additionalInfo) {
      message = message.replace(/{additionalInfo}/g, `หมายเหตุ: ${additionalInfo}\n`);
    } else {
      message = message.replace(/{additionalInfo}/g, '');
    }

    console.log('[LINE Template] Final message preview:', message.substring(0, 150) + '...');
    return message;
  }

  /**
   * สร้างข้อความแจ้งเตือนเมื่อมีการเปลี่ยนแปลงวันเวลานัดรับ
   */
  createAppointmentChangeMessage(
    customerName: string,
    repairNumber: string,
    deviceType: string,
    oldScheduledPickupTime?: Date | null,
    newScheduledPickupTime?: Date | string | null,
    oldReceiveDate?: Date | null,
    newReceiveDate?: Date | string | null,
    oldReceiveTime?: string | null,
    newReceiveTime?: string | null
  ): string {
    // ใช้เทมเพลตที่ผู้ใช้กำหนด หรือเทมเพลตเริ่มต้น
    let template = customStatusTemplates['appointment-change'] || DEFAULT_STATUS_TEMPLATES['appointment-change']?.template;
    
    if (!template) {
      console.warn('[LINE Template] ⚠️ No template found for appointment-change');
      return `แจ้งเตือน: วันเวลานัดรับเครื่องสำหรับงานซ่อม ${repairNumber} ได้ถูกเปลี่ยนแปลง`;
    }

    // Format วันเวลาเก่า
    let oldAppointmentDetails = '';
    if (oldScheduledPickupTime) {
      const formattedOld = oldScheduledPickupTime instanceof Date
        ? oldScheduledPickupTime.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : String(oldScheduledPickupTime);
      oldAppointmentDetails = `วันเวลานัดรับ (เดิม): ${formattedOld}`;
    } else if (oldReceiveDate || oldReceiveTime) {
      const oldDetails: string[] = [];
      if (oldReceiveDate) {
        const formattedOldDate = oldReceiveDate instanceof Date
          ? oldReceiveDate.toLocaleDateString('th-TH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          : String(oldReceiveDate);
        oldDetails.push(formattedOldDate);
      }
      if (oldReceiveTime) {
        oldDetails.push(`เวลา ${oldReceiveTime}`);
      }
      if (oldDetails.length > 0) {
        oldAppointmentDetails = `วันเวลานัดรับ (เดิม): ${oldDetails.join(' ')}`;
      }
    }

    // Format วันเวลาใหม่
    let newAppointmentDetails = '';
    if (newScheduledPickupTime) {
      let formattedNew: string;
      if (newScheduledPickupTime instanceof Date) {
        formattedNew = newScheduledPickupTime.toLocaleString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else if (typeof newScheduledPickupTime === 'string') {
        formattedNew = new Date(newScheduledPickupTime).toLocaleString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        formattedNew = String(newScheduledPickupTime);
      }
      newAppointmentDetails = `วันเวลานัดรับ (ใหม่): ${formattedNew}`;
    } else if (newReceiveDate || newReceiveTime) {
      const newDetails: string[] = [];
      if (newReceiveDate) {
        let formattedNewDate: string;
        if (newReceiveDate instanceof Date) {
          formattedNewDate = newReceiveDate.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        } else if (typeof newReceiveDate === 'string') {
          formattedNewDate = new Date(newReceiveDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        } else {
          formattedNewDate = String(newReceiveDate);
        }
        newDetails.push(formattedNewDate);
      }
      if (newReceiveTime) {
        newDetails.push(`เวลา ${newReceiveTime}`);
      }
      if (newDetails.length > 0) {
        newAppointmentDetails = `วันเวลานัดรับ (ใหม่): ${newDetails.join(' ')}`;
      }
    }

    // แทนที่ตัวแปรในเทมเพลต
    let message = template
      .replace(/{customerName}/g, customerName)
      .replace(/{repairNumber}/g, repairNumber)
      .replace(/{deviceType}/g, deviceType)
      .replace(/{oldAppointmentDetails}/g, oldAppointmentDetails || 'กรุณาติดต่อร้านเพื่อยืนยันวันเวลานัดรับเดิม')
      .replace(/{newAppointmentDetails}/g, newAppointmentDetails || 'กรุณาติดต่อร้านเพื่อยืนยันวันเวลานัดรับใหม่');

    console.log('[LINE Template] Appointment change message created');
    return message;
  }

  /**
   * ดึงเทมเพลตทั้งหมด
   */
  static getAllTemplates(): Record<string, StatusTemplate> {
    const templates: Record<string, StatusTemplate> = {};
    
    for (const [key, value] of Object.entries(DEFAULT_STATUS_TEMPLATES)) {
      templates[key] = {
        ...value,
        template: customStatusTemplates[key] || value.template,
      };
    }
    
    return templates;
  }

  /**
   * อัพเดทเทมเพลตสำหรับสถานะใดสถานะหนึ่ง
   */
  static updateTemplate(status: string, newTemplate: string): boolean {
    if (!DEFAULT_STATUS_TEMPLATES[status]) {
      console.error('[LINE Template Update] ❌ Invalid status:', status);
      return false;
    }
    
    console.log('[LINE Template Update] 📝 Updating template for status:', status);
    console.log('[LINE Template Update] New template preview:', newTemplate.substring(0, 150) + '...');
    customStatusTemplates[status] = newTemplate;
    console.log('[LINE Template Update] ✅ Updated successfully!');
    console.log('[LINE Template Update] Current custom templates:', Object.keys(customStatusTemplates));
    return true;
  }

  /**
   * รีเซ็ตเทมเพลตกลับไปใช้ค่าเริ่มต้น
   */
  static resetTemplate(status?: string): void {
    if (status) {
      console.log('[LINE Template Reset] 🔄 Resetting template for:', status);
      delete customStatusTemplates[status];
      console.log('[LINE Template Reset] ✅ Reset completed for:', status);
    } else {
      console.log('[LINE Template Reset] 🔄 Resetting ALL templates');
      // ลบทุก key แทนการ assign ใหม่ เพื่อให้ reference เดิมยังใช้ได้
      for (const key in customStatusTemplates) {
        delete customStatusTemplates[key];
      }
      console.log('[LINE Template Reset] ✅ All templates reset');
    }
    console.log('[LINE Template Reset] Current custom templates:', Object.keys(customStatusTemplates));
  }

  /**
   * ดึงเทมเพลตของสถานะเฉพาะ
   */
  static getTemplate(status: string): StatusTemplate | null {
    if (!DEFAULT_STATUS_TEMPLATES[status]) {
      return null;
    }
    
    return {
      ...DEFAULT_STATUS_TEMPLATES[status],
      template: customStatusTemplates[status] || DEFAULT_STATUS_TEMPLATES[status].template,
    };
  }

  /**
   * ส่งการแจ้งเตือนเมื่อสถานะการซ่อมเปลี่ยน
   */
  async notifyRepairStatusChange(
    customerLineId: string,
    customerName: string,
    repairNumber: string,
    newStatus: string,
    deviceType: string,
    additionalInfo?: string,
    receiveDate?: Date | string,
    receiveTime?: string,
    scheduledPickupTime?: Date | string
  ): Promise<boolean> {
    if (!customerLineId) {
      console.warn('[LINE] Customer does not have LINE ID, skipping notification');
      return false;
    }

    const message = this.createRepairStatusMessage(
      customerName,
      repairNumber,
      newStatus,
      deviceType,
      additionalInfo,
      receiveDate,
      receiveTime,
      scheduledPickupTime
    );

    return await this.sendNotification(customerLineId, message);
  }

  /**
   * ส่งข้อความแจ้งเตือนทั่วไป
   */
  async sendCustomMessage(userId: string, message: string): Promise<boolean> {
    return await this.sendNotification(userId, message);
  }

  /**
   * ส่ง Flex Message ไปยังลูกค้า (สำหรับใบเสร็จรับเงิน)
   */
  async sendFlexMessage(userId: string, flexMessage: object): Promise<boolean> {
    if (!userId || !this.channelAccessToken) {
      console.warn('[LINE] Cannot send flex message: Missing userId or access token');
      return false;
    }

    try {
      const payload = {
        to: userId,
        messages: [flexMessage],
      };

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.channelAccessToken}`,
        },
      });

      if (response.status === 200) {
        console.log(`[LINE] Flex message sent successfully to ${userId}`);
        return true;
      } else {
        console.error(`[LINE] Failed to send flex message: ${response.status}`, response.data);
        return false;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('[LINE] Error sending flex message:', {
          status: error.response?.status,
          data: error.response?.data,
          userId,
        });
      } else {
        console.error('[LINE] Unknown error sending flex message:', error);
      }
      return false;
    }
  }
}

// Singleton instance
let lineService: LineNotificationService | null = null;
let lastToken: string | null = null;

/**
 * สร้างหรือดึง instance ของ LINE Notification Service
 * จะสร้าง instance ใหม่ถ้า Token เปลี่ยน
 */
export function getLineNotificationService(): LineNotificationService | null {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelAccessToken) {
    console.warn('[LINE] LINE_CHANNEL_ACCESS_TOKEN not configured, LINE notifications disabled');
    lineService = null;
    lastToken = null;
    return null;
  }

  // ถ้า Token เปลี่ยน หรือยังไม่มี service instance ให้สร้างใหม่
  if (!lineService || lastToken !== channelAccessToken) {
    lineService = new LineNotificationService({ channelAccessToken });
    lastToken = channelAccessToken;
    console.log('[LINE] LINE Notification Service initialized');
    if (lastToken !== channelAccessToken) {
      console.log('[LINE] Token updated, service reinitialized');
    }
  }

  return lineService;
}
