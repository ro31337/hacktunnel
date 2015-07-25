// HackTunnel project
// (C) 2015 DevHQ, http://devhq.io
// License: AGPL 3

package util

import (
	"fmt"
)

// Helper for extracting string field from JSON structure
func GetStringField(data interface{}, field string) (string, error) {
	args, ok := data.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("json: invalid arguments format")
	}
	ret, ok := args[field].(string)
	if !ok {
		return "", fmt.Errorf("json: field '%s' not found", field)
	}
	return ret, nil
}

func GetInt64Field(data interface{}, field string) (int64, error) {
	args, ok := data.(map[string]interface{})
	if !ok {
		return 0, fmt.Errorf("json: invalid arguments format")
	}
	val, ok := args[field].(float64)
	if !ok {
		return 0, fmt.Errorf("json: field '%s' not found", field)
	}
	return int64(val), nil
}
