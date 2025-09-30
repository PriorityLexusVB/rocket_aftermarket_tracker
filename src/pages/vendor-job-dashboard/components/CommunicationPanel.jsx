import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const CommunicationPanel = ({ messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (newMessage?.trim()) {
      onSendMessage(newMessage?.trim());
      setNewMessage('');
    }
  };

  const getMessageStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <Icon name="Check" size={14} className="text-muted-foreground" />;
      case 'delivered': return <Icon name="CheckCheck" size={14} className="text-primary" />;
      case 'read': return <Icon name="CheckCheck" size={14} className="text-success" />;
      case 'failed': return <Icon name="AlertCircle" size={14} className="text-error" />;
      default: return <Icon name="Clock" size={14} className="text-muted-foreground" />;
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp)?.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="MessageSquare" size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Communication History</h3>
            <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
              {messages?.length} messages
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={20} />
          </Button>
        </div>
      </div>
      {/* Message List */}
      <div className={`transition-all duration-300 ${isExpanded ? 'max-h-96' : 'max-h-48'} overflow-y-auto`}>
        {messages?.length > 0 ? (
          <div className="p-4 space-y-4">
            {messages?.map((message) => (
              <div
                key={message?.id}
                className={`flex gap-3 ${message?.sender === 'You' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message?.sender === 'You' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <Icon 
                    name={message?.sender === 'You' ? 'User' : 'MessageCircle'} 
                    size={16} 
                  />
                </div>
                
                <div className={`flex-1 max-w-xs ${message?.sender === 'You' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block p-3 rounded-lg ${
                    message?.sender === 'You' ?'bg-primary text-primary-foreground' :'bg-muted text-foreground'
                  }`}>
                    <p className="text-sm">{message?.content}</p>
                  </div>
                  
                  <div className={`flex items-center gap-1 mt-1 text-xs text-muted-foreground ${
                    message?.sender === 'You' ? 'justify-end' : 'justify-start'
                  }`}>
                    <span>{formatTime(message?.timestamp)}</span>
                    {message?.sender === 'You' && getMessageStatusIcon(message?.status)}
                  </div>
                  
                  {message?.jobReference && (
                    <div className={`mt-1 text-xs ${
                      message?.sender === 'You' ? 'text-right' : 'text-left'
                    }`}>
                      <span className="text-muted-foreground">
                        Re: Job #{message?.jobReference}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Icon name="MessageSquare" size={48} className="mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No messages yet</h4>
            <p className="text-muted-foreground">Start a conversation with this vendor.</p>
          </div>
        )}
      </div>
      {/* Message Input */}
      <div className="p-4 border-t border-border">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e?.target?.value)}
              className="w-full"
            />
          </div>
          <Button
            type="submit"
            disabled={!newMessage?.trim()}
            iconName="Send"
            iconPosition="left"
          >
            Send SMS
          </Button>
        </form>
        
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Icon name="Smartphone" size={14} />
            <span>SMS delivery via Twilio</span>
          </div>
          <div className="flex items-center gap-1">
            <Icon name="Clock" size={14} />
            <span>Responses tracked automatically</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationPanel;