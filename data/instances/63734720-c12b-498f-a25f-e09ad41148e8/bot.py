import os
import sys
import time
import json
import urllib.request
import urllib.parse

TOKEN = os.environ.get('BOT_TOKEN', '')

if not TOKEN or TOKEN == 'YOUR_TELEGRAM_BOT_TOKEN_HERE':
    print('[ERROR] BOT_TOKEN environment variable is missing!')
    print('Please add your Telegram bot token in the Environment tab.')
    sys.exit(1)

API_URL = f"https://api.telegram.org/bot{TOKEN}/"

def call_api(method, data=None):
    url = API_URL + method
    try:
        if data:
            req_data = json.dumps(data).encode('utf-8')
            req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
        else:
            req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=35) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"[API ERROR] {e}")
        return None

def main():
    print("[INIT] Verifying Telegram Bot token...")
    me = call_api("getMe")
    if not me or not me.get('ok'):
        print(f"[AUTH FAILED] Invalid token or connection error: {me}")
        sys.exit(1)

    bot_name = me['result'].get('username')
    print(f"[ONLINE] Python Bot @{bot_name} is running!")
    print("[ONLINE] Listening for messages...")

    offset = 0
    start_time = time.time()

    while True:
        try:
            updates = call_api("getUpdates", {"offset": offset, "timeout": 30})
            if updates and updates.get('ok'):
                for item in updates.get('result', []):
                    offset = item['update_id'] + 1
                    msg = item.get('message')
                    if not msg or 'text' not in msg:
                        continue
                    
                    chat_id = msg['chat']['id']
                    text = msg.get('text', '').strip()
                    user = msg.get('from', {}).get('first_name', 'Friend')

                    print(f"[MSG from {user}]: {text}")

                    if text == '/start':
                        call_api("sendMessage", {
                            "chat_id": chat_id,
                            "text": f"👋 Hello {user}!\n\n🚀 Your Python Telegram bot is running smoothly on Cloud Hosting!\n\nCommands:\n/ping - Ping check\n/uptime - Bot uptime"
                        })
                    elif text == '/ping':
                        call_api("sendMessage", {
                            "chat_id": chat_id,
                            "text": "🏓 Pong! Python server is live!"
                        })
                    elif text == '/uptime':
                        uptime_sec = int(time.time() - start_time)
                        call_api("sendMessage", {
                            "chat_id": chat_id,
                            "text": f"⏱ Uptime: {uptime_sec} seconds"
                        })
                    else:
                        call_api("sendMessage", {
                            "chat_id": chat_id,
                            "text": f"Received: {text}"
                        })
        except Exception as err:
            print(f"[LOOP ERROR] {err}")
            time.sleep(3)

if __name__ == '__main__':
    main()
