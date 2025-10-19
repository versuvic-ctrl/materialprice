import json
import re


def parse_jsonc(jsonc_string):
    # Remove single-line comments (// ...)
    no_comments_string = re.sub(r'//.*', '', jsonc_string)
    # Remove multi-line comments (/* ... */)
    no_comments_string = re.sub(
        r'/\*.*?\*/', '', no_comments_string, flags=re.DOTALL
    )
    return json.loads(no_comments_string)