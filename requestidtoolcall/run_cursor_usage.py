# file: run_cursor_usage.py
import os, json, argparse
from pikachu_cursor_tool import fetch_cursor_usage_for_active_request, get_cursor_request_id_via_ui

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--request-id-only", action="store_true", help="Only copy and print the requestId")
    p.add_argument("--prefer-post", action="store_true", help="Use POST first to call the Admin API")
    args = p.parse_args()

    if args.request_id_only:
        rid = get_cursor_request_id_via_ui()
        print(rid)
        return

    api_key = os.environ.get("CURSOR_ADMIN_API_KEY")
    if not api_key:
        raise SystemExit("Set CURSOR_ADMIN_API_KEY in your environment")

    result = fetch_cursor_usage_for_active_request(api_key, prefer_post=args.prefer_post)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()