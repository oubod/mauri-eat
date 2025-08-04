import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { name, phone, address, cart, paymentMethod, paymentProofUrl } = await req.json()

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Upsert customer
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .upsert({ name, phone, address }, { onConflict: 'phone' })
      .select()
      .single();

    if (customerError) throw customerError;

    // Calculate total and create order
    const dishIds = cart.map(item => item.id);
    const { data: dishes, error: dishesError } = await supabaseAdmin
        .from('dishes')
        .select('id, price, restaurant_id')
        .in('id', dishIds);

    if(dishesError) throw dishesError;

    const total = cart.reduce((sum, item) => {
        const dish = dishes.find(d => d.id === item.id);
        return sum + (dish.price * item.quantity);
    }, 0);

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: customer.id,
        restaurant_id: dishes[0].restaurant_id, // Assuming all items are from the same restaurant
        total: total,
        status: 'paid', // Assuming payment is handled client-side
        customer_name: name,
        customer_phone: phone,
        address: address,
        payment_method: paymentMethod,
        payment_proof_url: paymentProofUrl
      })
      .select()
      .single()

    if (orderError) throw orderError

    // Create order items
    const orderItems = cart.map(item => ({
        order_id: order.id,
        dish_id: item.id,
        quantity: item.quantity,
        price: dishes.find(d => d.id === item.id).price
    }));

    const { error: orderItemsError } = await supabaseAdmin
        .from('order_items')
        .insert(orderItems);

    if (orderItemsError) throw orderItemsError;

    return new Response(JSON.stringify({ order }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
