'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// schema based on actual db schema
// we will use this to parse the incoming data into db appropriate type
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(), // change any incoming types to number
    status: z.enum(['pending', 'paid']),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true});

export async function createInvoice(formData: FormData) {
    // parse into the defined schema above and store into the consts
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100; // convert amount to cents for floating-point errors
    const date = new Date().toISOString().split('T')[0];    

    // finally write the data into the db
    await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
    /**
     * !!!
     NextJS has a feature called Client Side Router Cache. This stores the route segment in the user's browser for a time. 
     It benefits include prefetching and also ensures that users can navigate in between routes, reducing the number
     of requests made to the server.

     As data is updated thats displayed in the invoices route, we want to clear this cache and trigger a new request to 
     the server. We do this by revalidatePath().
     * !!!
     */
}