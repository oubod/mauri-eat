import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { name, phone, address, cart, paymentMethod, paymentProofUrl } = await req.json()

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if user with this phone number already exists
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .single()

    let userId;

    if (profile) {
      userId = profile.id;
    } else {
      // Create a new user
      const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: `${phone}@mauri-eat.com`, // Create a dummy email
        password: `password-${phone}`, // Create a dummy password
        phone: phone,
        user_metadata: { full_name: name }
      })

      if (userError) throw userError

      userId = newUser.user.id

      // Update the profile with the phone number
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({ phone: phone })
        .eq('id', userId)

      if (updateProfileError) throw updateProfileError
    }

    // Calculate total and create order
    const dishIds = cart.map(item => item.id);
    const { data: dishes, error: dishesError } = await supabaseAdmin
        .from('dishes')
        .select('id, price')
        .in('id', dishIds);

    if(dishesError) throw dishesError;

    const total = cart.reduce((sum, item) => {
        const dish = dishes.find(d => d.id === item.id);
        return sum + (dish.price * item.quantity);
    }, 0);

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: userId,
        restaurant_id: cart[0].restaurant_id, // Assuming all items are from the same restaurant
        total: total,
        status: 'paid',
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
