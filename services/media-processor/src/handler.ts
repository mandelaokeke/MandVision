export const main = async (event: any) => {
console.log("Received SQS event:", JSON.stringify(event, null, 2));
for (const record of event.Records || []) {
const body = JSON.parse(record.body);
console.log("S3 event received:", JSON.stringify(body, null, 2));
 }
return {
statusCode: 200,
body: JSON.stringify({ message: "Media processing event received" }),
};
};
