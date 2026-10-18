import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', '', true)`;
    await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`;

    const variants = await tx.productVariant.findMany({
      where: { active: true, stock: { gt: 2 } },
      take: 2,
      select: {
        id: true,
        sku: true,
        price: true,
        name: true,
        product: { select: { name: true } },
      },
    });
    if (variants.length < 1) throw new Error('no active variants with stock');

    const lines = variants.map((v) => ({
      variantId: v.id,
      title: `${v.product.name} — ${v.name}`,
      sku: v.sku,
      qty: 1,
      unitPrice: v.price,
      lineTotal: v.price,
    }));
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const shippingCost = 350;
    const total = subtotal + shippingCost;
    const number = `MF-TEST-${Date.now().toString(36).toUpperCase()}`;

    return tx.order.create({
      data: {
        number,
        status: 'PAID',
        email: 'test-admin-edit@vspomni.local',
        phone: '+79001234567',
        customerName: 'Тест Админ-правки',
        guestId: 'guest-admin-edit-test',
        shippingMethod: 'CDEK',
        shippingCost,
        subtotal,
        discountTotal: 0,
        giftCertificateAmount: 0,
        total,
        refundedAmount: 0,
        shippingAddress: {
          city: 'Москва',
          address: 'Тверская 1',
          apartment: '12',
          region: 'Москва',
          district: '',
          postalCode: '125009',
          comment: '__JCOS:carrier=cdek|dropoff=courier__',
          pvzCode: '',
          phone: '+79001234567',
          recipientName: 'Тест Админ-правки',
        },
        items: { create: lines },
        payments: {
          create: {
            provider: 'yookassa',
            status: 'SUCCEEDED',
            amount: total,
            externalId: `test-pay-${Date.now()}`,
          },
        },
        events: {
          create: {
            type: 'CREATED',
            message:
              'Тестовый заказ для проверки правки адреса/состава в админке',
          },
        },
      },
      select: { id: true, number: true, status: true, total: true },
    });
  });

  console.log(JSON.stringify(order, null, 2));
  console.log(`http://localhost:3010/admin/orders/${order.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
